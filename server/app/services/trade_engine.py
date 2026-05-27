"""
XMLiquidity — Trade Execution Engine
Handles: market orders, limit/stop orders, trade close, partial close, SL/TP modification.
Calculates margin, P&L, applies charges.
"""

from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId
from fastapi import HTTPException

from app.models.trade import Trade, TradeDirection, OrderType, TradeStatus
from app.models.account import TradingAccount
from app.models.instrument import Instrument
from app.services.charge_calculator import get_charges


async def open_trade(
    account: TradingAccount,
    instrument_symbol: str,
    direction: str,
    lot_size: float,
    order_type: str = "market",
    price: float = 0.0,
    stop_loss: Optional[float] = None,
    take_profit: Optional[float] = None,
    trigger_price: Optional[float] = None,
    limit_price: Optional[float] = None,
) -> Trade:
    """
    Open a new trade on a trading account.
    Validates: account funded, sufficient margin, instrument exists, lot limits.
    """

    # 1. Validate account is funded and active
    if not account.is_funded:
        raise HTTPException(status_code=400, detail="Account not funded. Deposit funds first.")
    if account.status.value != "active" and str(account.status) != "active":
        raise HTTPException(status_code=400, detail="Account is not active")

    # 2. Validate instrument
    instrument = await Instrument.find_one(
        Instrument.symbol == instrument_symbol.upper(),
        Instrument.is_active == True,
        Instrument.is_hidden == False,
    )
    if not instrument:
        raise HTTPException(status_code=404, detail=f"Instrument {instrument_symbol} not found or not available")

    # 3. Validate lot size
    if lot_size < instrument.min_lot:
        raise HTTPException(status_code=400, detail=f"Minimum lot size is {instrument.min_lot}")
    if lot_size > instrument.max_lot:
        raise HTTPException(status_code=400, detail=f"Maximum lot size is {instrument.max_lot}")

    # 4. Calculate margin required
    # Margin = (Lot Size × Contract Size × Price) / Leverage
    contract_value = lot_size * instrument.lot_size * price
    margin_required = contract_value / account.leverage

    # 5. Check sufficient free margin
    if margin_required > account.free_margin:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient margin. Required: ${margin_required:.2f}, Available: ${account.free_margin:.2f}",
        )

    # 6. Get charges for this trade
    charges = await get_charges(
        user_id=str(account.user_id),
        account_type=account.account_type.value,
        instrument_symbol=instrument.symbol,
        segment=instrument.segment.value if instrument.segment else None,
    )

    # Calculate spread cost
    spread_cost = charges["spread_markup"] * instrument.pip_size * lot_size * instrument.lot_size
    commission_cost = charges["commission_per_lot"] * lot_size

    # 7. Determine trade status based on order type
    trade_direction = TradeDirection.BUY if direction.lower() == "buy" else TradeDirection.SELL
    trade_order_type = OrderType(order_type.lower())

    trade_status = TradeStatus.OPEN
    if trade_order_type != OrderType.MARKET:
        trade_status = TradeStatus.PENDING  # Limit/stop orders wait for trigger

    # 8. Create trade
    trade = Trade(
        account_id=account.id,
        user_id=account.user_id,
        instrument=instrument.symbol,
        segment=instrument.segment.value if instrument.segment else "forex",
        direction=trade_direction,
        order_type=trade_order_type,
        status=trade_status,
        lot_size=lot_size,
        original_lot_size=lot_size,
        open_price=price,
        current_price=price,
        stop_loss=stop_loss,
        take_profit=take_profit,
        trigger_price=trigger_price,
        limit_price=limit_price,
        leverage=account.leverage,
        margin_used=margin_required,
        spread_charged=spread_cost,
        commission_charged=commission_cost,
    )
    await trade.insert()

    # 9. Update account margin (only for market orders that are immediately open)
    if trade_status == TradeStatus.OPEN:
        account.margin_used += margin_required
        account.free_margin = account.equity - account.margin_used
        # Deduct spread + commission from balance
        account.balance -= (spread_cost + commission_cost)
        account.equity -= (spread_cost + commission_cost)
        account.free_margin -= (spread_cost + commission_cost)
        account.updated_at = datetime.now(timezone.utc)
        await account.save()

    return trade


async def close_trade(
    trade: Trade,
    close_price: float,
    account: Optional[TradingAccount] = None,
) -> Trade:
    """
    Close an open trade at the given price.
    Calculates realized P&L, releases margin, updates account stats.
    """
    if trade.status != TradeStatus.OPEN:
        raise HTTPException(status_code=400, detail="Trade is not open")

    if not account:
        account = await TradingAccount.get(trade.account_id)

    # Calculate P&L
    if trade.direction == TradeDirection.BUY:
        pnl = (close_price - trade.open_price) * trade.lot_size * 100000  # Simplified for forex
    else:
        pnl = (trade.open_price - close_price) * trade.lot_size * 100000

    # Update trade
    trade.close_price = close_price
    trade.pnl = round(pnl, 2)
    trade.status = TradeStatus.CLOSED
    trade.close_time = datetime.now(timezone.utc)
    await trade.save()

    # Update account
    account.margin_used -= trade.margin_used
    account.balance += pnl
    account.equity = account.balance + await _calc_unrealized_pnl(account.id)
    account.free_margin = account.equity - account.margin_used
    account.total_trades += 1
    account.total_pnl += pnl
    if pnl > 0:
        account.win_count += 1
    else:
        account.loss_count += 1
    account.updated_at = datetime.now(timezone.utc)
    await account.save()

    return trade


async def partial_close_trade(
    trade: Trade,
    close_lot_size: float,
    close_price: float,
) -> Trade:
    """
    Partially close a trade — reduce lot size and realize partial P&L.
    """
    if trade.status != TradeStatus.OPEN:
        raise HTTPException(status_code=400, detail="Trade is not open")
    if close_lot_size >= trade.lot_size:
        raise HTTPException(status_code=400, detail="Partial close lot must be less than current lot size")
    if close_lot_size <= 0:
        raise HTTPException(status_code=400, detail="Close lot size must be positive")

    account = await TradingAccount.get(trade.account_id)

    # Calculate partial P&L
    if trade.direction == TradeDirection.BUY:
        partial_pnl = (close_price - trade.open_price) * close_lot_size * 100000
    else:
        partial_pnl = (trade.open_price - close_price) * close_lot_size * 100000

    partial_pnl = round(partial_pnl, 2)

    # Calculate margin released proportionally
    margin_ratio = close_lot_size / trade.lot_size
    margin_released = trade.margin_used * margin_ratio

    # Record partial close
    trade.partial_closes.append({
        "lot_size": close_lot_size,
        "close_price": close_price,
        "pnl": partial_pnl,
        "closed_at": datetime.now(timezone.utc).isoformat(),
    })

    # Update trade
    trade.lot_size -= close_lot_size
    trade.margin_used -= margin_released
    trade.pnl += partial_pnl
    await trade.save()

    # Update account
    account.margin_used -= margin_released
    account.balance += partial_pnl
    account.equity = account.balance + await _calc_unrealized_pnl(account.id)
    account.free_margin = account.equity - account.margin_used
    account.total_pnl += partial_pnl
    account.updated_at = datetime.now(timezone.utc)
    await account.save()

    return trade


async def modify_trade(
    trade: Trade,
    stop_loss: Optional[float] = None,
    take_profit: Optional[float] = None,
) -> Trade:
    """Modify SL/TP on an open trade."""
    if trade.status != TradeStatus.OPEN:
        raise HTTPException(status_code=400, detail="Trade is not open")

    if stop_loss is not None:
        trade.stop_loss = stop_loss
    if take_profit is not None:
        trade.take_profit = take_profit

    await trade.save()
    return trade


async def cancel_pending_order(trade: Trade) -> Trade:
    """Cancel a pending limit/stop order."""
    if trade.status != TradeStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending orders can be cancelled")

    trade.status = TradeStatus.CANCELLED
    await trade.save()
    return trade


async def _calc_unrealized_pnl(account_id: PydanticObjectId) -> float:
    """Calculate total unrealized P&L for all open trades on an account."""
    open_trades = await Trade.find(
        Trade.account_id == account_id,
        Trade.status == TradeStatus.OPEN,
    ).to_list()

    total = 0.0
    for t in open_trades:
        if t.direction == TradeDirection.BUY:
            total += (t.current_price - t.open_price) * t.lot_size * 100000
        else:
            total += (t.open_price - t.current_price) * t.lot_size * 100000

    return round(total, 2)


async def check_margin_and_liquidate(account_id: PydanticObjectId) -> dict:
    """
    AUTO SQUARE-OFF: Check if account equity is negative or margin level < 20%.
    If triggered, close ALL open trades at current prices.
    Called by frontend or by a periodic backend task.
    """
    account = await TradingAccount.get(account_id)
    if not account:
        return {"liquidated": False, "reason": "Account not found"}

    open_trades = await Trade.find(
        Trade.account_id == account_id,
        Trade.status == TradeStatus.OPEN,
    ).to_list()

    if not open_trades:
        return {"liquidated": False, "reason": "No open trades"}

    # Calculate unrealized P&L
    unrealized = 0.0
    margin_used = 0.0
    for t in open_trades:
        if t.direction == TradeDirection.BUY:
            unrealized += (t.current_price - t.open_price) * t.lot_size * 100000
        else:
            unrealized += (t.open_price - t.current_price) * t.lot_size * 100000
        margin_used += t.margin_used

    equity = account.balance + unrealized
    margin_level = (equity / margin_used * 100) if margin_used > 0 else 999

    # STOP OUT CONDITIONS:
    # 1. Equity <= 0
    # 2. Margin level < 20% (stop out level)
    # 3. Free margin deeply negative (equity - margin < -50% of balance)
    should_liquidate = (
        equity <= 0
        or margin_level < 20
        or (equity - margin_used) < -(account.balance * 0.5)
    )

    if not should_liquidate:
        return {
            "liquidated": False,
            "equity": round(equity, 2),
            "margin_level": round(margin_level, 2),
            "unrealized_pnl": round(unrealized, 2),
        }

    # LIQUIDATE ALL POSITIONS
    total_pnl = 0.0
    closed_count = 0

    for trade in open_trades:
        try:
            close_price = trade.current_price
            if trade.direction == TradeDirection.BUY:
                pnl = (close_price - trade.open_price) * trade.lot_size * 100000
            else:
                pnl = (trade.open_price - close_price) * trade.lot_size * 100000

            trade.close_price = close_price
            trade.pnl = round(pnl, 2)
            trade.status = TradeStatus.CLOSED
            trade.close_time = datetime.now(timezone.utc)
            await trade.save()

            total_pnl += pnl
            closed_count += 1

            # Release margin
            account.margin_used -= trade.margin_used
            account.balance += pnl
            account.total_trades += 1
            account.total_pnl += pnl
            if pnl > 0:
                account.win_count += 1
            else:
                account.loss_count += 1
        except Exception as e:
            print(f"[LIQUIDATE] Failed to close trade {trade.id}: {e}")

    account.equity = account.balance
    account.free_margin = account.balance - account.margin_used
    account.updated_at = datetime.now(timezone.utc)
    await account.save()

    reason = "Equity <= 0" if equity <= 0 else f"Margin level {margin_level:.1f}% < 20%"
    print(f"[STOP OUT] Account {account.account_number} liquidated: {reason} | Closed {closed_count} trades | P&L: ${total_pnl:.2f}")

    return {
        "liquidated": True,
        "reason": reason,
        "closed_count": closed_count,
        "total_pnl": round(total_pnl, 2),
        "final_balance": round(account.balance, 2),
    }
