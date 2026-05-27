"""
XMLiquidity — Bot / Algo Router
Create bots, get webhook URLs, receive TradingView alerts, signal history.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from typing import Optional

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.bot import Bot, BotSignal, BotStatus, BotSignalStatus
from app.models.account import TradingAccount
from app.models.trade import Trade
from app.models.instrument import Instrument
from app.services.bot_execution import (
    webhook_url_for_secret,
    normalize_webhook_payload,
    parse_tradingview_payload,
    merge_bot_alert_defaults,
    tradingview_alert_json_examples,
    fetch_reference_price,
    compute_effective_lot_size,
)

router = APIRouter(prefix="/bots", tags=["Algo Bots"])


class CreateBotRequest(BaseModel):
    account_id: str
    name: str = Field("My Bot", max_length=100)
    strategy_name: str = Field("", max_length=100)
    default_lot_size: float = Field(0.01, gt=0, le=100)
    max_lot_size: float = Field(1.0, gt=0, le=100)
    risk_per_trade_pct: float = Field(0.0, ge=0, le=100)
    use_sl: bool = True
    use_tp: bool = True
    # Price alerts without Pine strategy order — auto buy/sell when JSON omits "action"
    default_order_action: str = ""
    # Optional: always trade this symbol if webhook omits ticker (must match platform instrument e.g. XAUUSD)
    fixed_symbol: str = Field("", max_length=32)

    @field_validator("default_order_action")
    @classmethod
    def validate_default_order_action(cls, v: str) -> str:
        s = (v or "").lower().strip()
        if s in ("", "buy", "sell"):
            return s
        raise ValueError('default_order_action must be "", "buy", or "sell"')


@router.post("/", status_code=201)
async def create_bot(data: CreateBotRequest, user: User = Depends(get_current_user)):
    """Create a new algo bot linked to a trading account."""
    account = await TradingAccount.get(data.account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    if not account.is_funded:
        raise HTTPException(status_code=400, detail="Account must be funded")

    fs = (data.fixed_symbol or "").strip().upper().replace("/", "")
    bot = Bot(
        user_id=user.id,
        account_id=account.id,
        name=data.name,
        strategy_name=data.strategy_name,
        default_lot_size=data.default_lot_size,
        max_lot_size=data.max_lot_size,
        risk_per_trade_pct=data.risk_per_trade_pct,
        use_sl=data.use_sl,
        use_tp=data.use_tp,
        default_order_action=data.default_order_action,
        fixed_symbol=fs,
    )
    await bot.insert()

    wh_url = webhook_url_for_secret(bot.webhook_secret)
    tv = tradingview_alert_json_examples(bot, wh_url)

    return {
        "id": str(bot.id),
        "name": bot.name,
        "webhook_url": wh_url,
        "webhook_secret": bot.webhook_secret,
        "account_number": account.account_number,
        "default_lot_size": bot.default_lot_size,
        "max_lot_size": bot.max_lot_size,
        "risk_per_trade_pct": bot.risk_per_trade_pct,
        "default_order_action": bot.default_order_action,
        "fixed_symbol": bot.fixed_symbol or None,
        **tv,
        "message": "Bot created. Paste webhook_url in TradingView → Alert → Webhook URL; message JSON from message_minimal_json.",
    }


@router.get("/")
async def list_bots(user: User = Depends(get_current_user)):
    """List all user's bots."""
    bots = await Bot.find(Bot.user_id == user.id).sort("-created_at").to_list()
    result = []
    for b in bots:
        acct = await TradingAccount.get(b.account_id)
        wh = webhook_url_for_secret(b.webhook_secret)
        tv = tradingview_alert_json_examples(b, wh)
        result.append({
            "id": str(b.id),
            "name": b.name,
            "strategy_name": b.strategy_name,
            "status": b.status.value,
            "account_number": acct.account_number if acct else "",
            "webhook_url": wh,
            "default_lot_size": b.default_lot_size,
            "max_lot_size": b.max_lot_size,
            "risk_per_trade_pct": b.risk_per_trade_pct,
            "use_sl": b.use_sl,
            "use_tp": b.use_tp,
            "default_order_action": getattr(b, "default_order_action", "") or "",
            "fixed_symbol": getattr(b, "fixed_symbol", "") or None,
            "message_minimal_json": tv["message_minimal_json"],
            "message_full_json": tv["message_full_json"],
            "total_signals": b.total_signals,
            "total_trades_executed": b.total_trades_executed,
            "total_pnl": round(b.total_pnl, 2),
            "created_at": b.created_at.isoformat(),
        })
    return result


@router.post("/webhook/{webhook_secret}")
async def receive_webhook(webhook_secret: str, request: Request):
    """
    TradingView webhook endpoint. Receives alert → parses → auto-executes trade.
    No auth required (uses webhook secret for verification).
    """
    bot = await Bot.find_one(Bot.webhook_secret == webhook_secret, Bot.is_active == True)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    if bot.status != BotStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Bot is paused or disabled")

    try:
        payload = await request.json()
    except Exception:
        body = await request.body()
        payload = {"raw": body.decode("utf-8", errors="replace")}

    payload = normalize_webhook_payload(payload)

    parsed = parse_tradingview_payload(payload)
    merged = merge_bot_alert_defaults(parsed, bot)
    action = merged.action
    instrument = merged.instrument
    lot_base = merged.lot_size if merged.lot_size > 0 else bot.default_lot_size
    price = merged.price
    sl_raw = merged.sl if bot.use_sl else 0.0
    tp_raw = merged.tp if bot.use_tp else 0.0

    signal = BotSignal(
        bot_id=bot.id,
        raw_payload=payload if isinstance(payload, dict) else {"raw": str(payload)},
        action=action,
        instrument=instrument,
        lot_size=lot_base,
        price=price,
        sl=sl_raw,
        tp=tp_raw,
    )

    bot.total_signals += 1

    # Execute based on action
    if action in ("buy", "sell"):
        try:
            account = await TradingAccount.get(bot.account_id)
            if not instrument:
                signal.status = BotSignalStatus.FAILED
                signal.error_message = (
                    "Missing symbol — add {{ticker}} to JSON or set Fixed symbol on the bot"
                )
            elif not account or not account.is_funded:
                signal.status = BotSignalStatus.FAILED
                signal.error_message = "Account not funded"
            else:
                inst_doc = await Instrument.find_one(
                    Instrument.symbol == instrument.upper(),
                    Instrument.is_active == True,
                    Instrument.is_hidden == False,
                )
                if not inst_doc:
                    signal.status = BotSignalStatus.FAILED
                    signal.error_message = f"Instrument {instrument} not available"
                else:
                    exec_price = price
                    if exec_price <= 0:
                        exec_price = await fetch_reference_price(instrument) or 0.0
                    if exec_price <= 0:
                        signal.status = BotSignalStatus.FAILED
                        signal.error_message = (
                            "No price in alert and live quote unavailable — add {{close}} or price to alert "
                            "or set INFOWAY_API_KEY for auto pricing."
                        )
                    else:
                        lot_size = compute_effective_lot_size(
                            bot, account, inst_doc, exec_price, sl_raw, lot_base
                        )
                        signal.lot_size = lot_size
                        signal.price = exec_price

                        sl_exec = sl_raw if sl_raw > 0 else None
                        tp_exec = tp_raw if tp_raw > 0 else None

                        from app.services.trade_engine import open_trade

                        trade = await open_trade(
                            account=account,
                            instrument_symbol=instrument,
                            direction=action,
                            lot_size=lot_size,
                            price=exec_price,
                            stop_loss=sl_exec,
                            take_profit=tp_exec,
                        )
                        trade.is_bot_trade = True
                        trade.bot_id = bot.id
                        await trade.save()

                        signal.trade_id = trade.id
                        signal.status = BotSignalStatus.EXECUTED
                        bot.total_trades_executed += 1
        except Exception as e:
            signal.status = BotSignalStatus.FAILED
            signal.error_message = str(e)

    elif action in ("close", "closelong", "closeshort"):
        from app.models.trade import TradeStatus, TradeDirection

        if not instrument:
            signal.status = BotSignalStatus.FAILED
            signal.error_message = "Missing symbol/ticker for close"
        else:
            close_px = price
            if close_px <= 0:
                close_px = await fetch_reference_price(instrument) or 0.0
            if close_px <= 0:
                signal.status = BotSignalStatus.FAILED
                signal.error_message = (
                    "Close requires price or {{close}} in alert (or INFOWAY_API_KEY for live quote)"
                )
            else:
                signal.price = close_px
                query_filter = {
                    "account_id": bot.account_id,
                    "status": TradeStatus.OPEN,
                    "instrument": instrument,
                }
                if action == "closelong":
                    query_filter["direction"] = TradeDirection.BUY
                elif action == "closeshort":
                    query_filter["direction"] = TradeDirection.SELL

                open_trades = await Trade.find(query_filter).to_list()
                if open_trades:
                    from app.services.trade_engine import close_trade

                    for t in open_trades:
                        await close_trade(t, close_px)
                    signal.status = BotSignalStatus.EXECUTED
                else:
                    signal.status = BotSignalStatus.IGNORED
                    signal.error_message = "No matching open trades"
    else:
        signal.status = BotSignalStatus.IGNORED
        signal.error_message = (
            f"Missing or unknown action: {action!r}. "
            'Put "action":"buy" or "sell" in the alert JSON, or set Default order (buy/sell) on this bot.'
        )

    await signal.insert()
    await bot.save()

    return {"status": signal.status.value, "message": signal.error_message or "OK"}


@router.get("/{bot_id}/signals")
async def get_bot_signals(
    bot_id: str,
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get signal history for a bot."""
    bot = await Bot.get(bot_id)
    if not bot or bot.user_id != user.id:
        raise HTTPException(status_code=404, detail="Bot not found")

    total = await BotSignal.find(BotSignal.bot_id == bot.id).count()
    skip = (page - 1) * per_page
    signals = await BotSignal.find(BotSignal.bot_id == bot.id).sort("-created_at").skip(skip).limit(per_page).to_list()

    return {
        "signals": [
            {
                "id": str(s.id),
                "action": s.action,
                "instrument": s.instrument,
                "lot_size": s.lot_size,
                "price": s.price,
                "status": s.status.value,
                "error_message": s.error_message,
                "trade_id": str(s.trade_id) if s.trade_id else None,
                "created_at": s.created_at.isoformat(),
            }
            for s in signals
        ],
        "total": total,
        "page": page,
    }


@router.patch("/{bot_id}/toggle")
async def toggle_bot(bot_id: str, user: User = Depends(get_current_user)):
    """Pause or activate a bot."""
    bot = await Bot.get(bot_id)
    if not bot or bot.user_id != user.id:
        raise HTTPException(status_code=404, detail="Bot not found")

    bot.status = BotStatus.PAUSED if bot.status == BotStatus.ACTIVE else BotStatus.ACTIVE
    await bot.save()
    return {"status": bot.status.value}
