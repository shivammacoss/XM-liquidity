"""
XMLiquidity — Trades Router
Open, close, partial close, modify SL/TP, cancel pending, history.
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from beanie import PydanticObjectId as ObjId

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.account import TradingAccount
from app.models.trade import Trade, TradeStatus
from app.services.trade_engine import (
    open_trade, close_trade, partial_close_trade,
    modify_trade, cancel_pending_order, check_margin_and_liquidate,
)

router = APIRouter(prefix="/trades", tags=["Trading"])


# --- Schemas ---

class OpenTradeRequest(BaseModel):
    account_id: str
    instrument: str
    direction: str = Field(..., pattern="^(buy|sell)$")
    lot_size: float = Field(..., gt=0, le=100)
    order_type: str = Field("market", pattern="^(market|limit|stop_limit|target_limit)$")
    price: float = Field(..., gt=0)
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    trigger_price: Optional[float] = None
    limit_price: Optional[float] = None


class CloseTradeRequest(BaseModel):
    close_price: float = Field(..., gt=0)


class PartialCloseRequest(BaseModel):
    lot_size: float = Field(..., gt=0)
    close_price: float = Field(..., gt=0)


class ModifyTradeRequest(BaseModel):
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None


class TradeResponse(BaseModel):
    id: str
    account_id: str
    instrument: str
    segment: str
    direction: str
    order_type: str
    status: str
    lot_size: float
    original_lot_size: float
    open_price: float
    close_price: Optional[float]
    current_price: float
    stop_loss: Optional[float]
    take_profit: Optional[float]
    leverage: int
    margin_used: float
    pnl: float
    unrealized_pnl: float
    spread_charged: float
    swap_charged: float
    commission_charged: float
    is_copy_trade: bool
    is_bot_trade: bool
    partial_closes: list
    open_time: str
    close_time: Optional[str]


def _trade_to_response(t: Trade) -> TradeResponse:
    return TradeResponse(
        id=str(t.id),
        account_id=str(t.account_id),
        instrument=t.instrument,
        segment=t.segment,
        direction=t.direction.value,
        order_type=t.order_type.value,
        status=t.status.value,
        lot_size=t.lot_size,
        original_lot_size=t.original_lot_size,
        open_price=t.open_price,
        close_price=t.close_price,
        current_price=t.current_price,
        stop_loss=t.stop_loss,
        take_profit=t.take_profit,
        leverage=t.leverage,
        margin_used=round(t.margin_used, 2),
        pnl=round(t.pnl, 2),
        unrealized_pnl=round(t.unrealized_pnl, 2),
        spread_charged=round(t.spread_charged, 2),
        swap_charged=round(t.swap_charged, 2),
        commission_charged=round(t.commission_charged, 2),
        is_copy_trade=t.is_copy_trade,
        is_bot_trade=t.is_bot_trade,
        partial_closes=t.partial_closes,
        open_time=t.open_time.isoformat(),
        close_time=t.close_time.isoformat() if t.close_time else None,
    )


# --- Endpoints ---

@router.post("/open", response_model=TradeResponse, status_code=201)
async def open_new_trade(
    data: OpenTradeRequest,
    user: User = Depends(get_current_user),
):
    """Open a new trade (market, limit, stop, or target limit order)."""
    account = await TradingAccount.get(data.account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found")

    if user.is_trading_restricted:
        raise HTTPException(status_code=403, detail="Trading is restricted on your account")

    trade = await open_trade(
        account=account,
        instrument_symbol=data.instrument,
        direction=data.direction,
        lot_size=data.lot_size,
        order_type=data.order_type,
        price=data.price,
        stop_loss=data.stop_loss,
        take_profit=data.take_profit,
        trigger_price=data.trigger_price,
        limit_price=data.limit_price,
    )

    # Check prop rules if this is a prop account
    if account.is_prop_account and account.prop_account_id:
        from app.services.prop_engine import check_prop_rules
        await check_prop_rules(account.prop_account_id, "trade_open", trade)

    return _trade_to_response(trade)


@router.post("/{trade_id}/close", response_model=TradeResponse)
async def close_existing_trade(
    trade_id: str,
    data: CloseTradeRequest,
    user: User = Depends(get_current_user),
):
    """Close an open trade at the specified price."""
    trade = await Trade.get(trade_id)
    if not trade or trade.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trade not found")

    trade = await close_trade(trade, data.close_price)
    return _trade_to_response(trade)


@router.post("/{trade_id}/partial-close", response_model=TradeResponse)
async def partial_close_existing_trade(
    trade_id: str,
    data: PartialCloseRequest,
    user: User = Depends(get_current_user),
):
    """Partially close a trade — reduce lot size and realize partial P&L."""
    trade = await Trade.get(trade_id)
    if not trade or trade.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trade not found")

    trade = await partial_close_trade(trade, data.lot_size, data.close_price)
    return _trade_to_response(trade)


@router.patch("/{trade_id}/modify", response_model=TradeResponse)
async def modify_existing_trade(
    trade_id: str,
    data: ModifyTradeRequest,
    user: User = Depends(get_current_user),
):
    """Modify SL/TP on an open trade."""
    trade = await Trade.get(trade_id)
    if not trade or trade.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trade not found")

    trade = await modify_trade(trade, data.stop_loss, data.take_profit)
    return _trade_to_response(trade)


@router.post("/{trade_id}/cancel", response_model=TradeResponse)
async def cancel_order(
    trade_id: str,
    user: User = Depends(get_current_user),
):
    """Cancel a pending limit/stop order."""
    trade = await Trade.get(trade_id)
    if not trade or trade.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trade not found")

    trade = await cancel_pending_order(trade)
    return _trade_to_response(trade)


@router.get("/open", response_model=list)
async def get_open_trades(
    user: User = Depends(get_current_user),
    account_id: str = Query(None),
):
    """Get all open trades for the user, optionally filtered by account."""
    query = Trade.find(Trade.user_id == user.id, Trade.status == TradeStatus.OPEN)
    if account_id:
        try:
            query = query.find(Trade.account_id == ObjId(account_id))
        except Exception:
            pass

    trades = await query.sort("-open_time").to_list()
    return [_trade_to_response(t) for t in trades]


@router.get("/pending", response_model=list)
async def get_pending_orders(
    user: User = Depends(get_current_user),
    account_id: str = Query(None),
):
    """Get all pending limit/stop orders."""
    query = Trade.find(Trade.user_id == user.id, Trade.status == TradeStatus.PENDING)
    if account_id:
        try:
            query = query.find(Trade.account_id == ObjId(account_id))
        except Exception:
            pass

    trades = await query.sort("-created_at").to_list()
    return [_trade_to_response(t) for t in trades]


@router.get("/history")
async def get_trade_history(
    user: User = Depends(get_current_user),
    account_id: str = Query(None),
    instrument: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get closed trade history with pagination."""
    from beanie.operators import In
    query = Trade.find(
        Trade.user_id == user.id,
        In(Trade.status, [TradeStatus.CLOSED, TradeStatus.CANCELLED]),
    )
    if account_id:
        try:
            query = query.find(Trade.account_id == ObjId(account_id))
        except Exception:
            pass
    if instrument:
        query = query.find(Trade.instrument == instrument.upper())

    total = await query.count()
    skip = (page - 1) * per_page
    trades = await query.sort("-close_time").skip(skip).limit(per_page).to_list()

    return {
        "trades": [_trade_to_response(t) for t in trades],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post("/check-margin/{account_id}")
async def check_margin(
    account_id: str,
    user: User = Depends(get_current_user),
):
    """
    Check margin health for an account.
    If equity <= 0 or margin level < 20%, auto-liquidates ALL open positions.
    Called by frontend every few seconds during active trading.
    """
    account = await TradingAccount.get(account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found")

    result = await check_margin_and_liquidate(account.id)
    return result
