"""
SwisTrade — Algo bot webhook helpers
Builds public webhook URLs, parses TradingView payloads, optional risk-based sizing, live price fallback.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.config import settings
from app.models.account import TradingAccount
from app.models.bot import Bot
from app.models.instrument import Instrument


def webhook_url_for_secret(webhook_secret: str) -> str:
    """Full HTTPS URL traders paste into TradingView / external algos."""
    base = settings.public_api_base_url.strip().rstrip("/")
    if not base:
        base = "http://localhost:8000"
    ver = settings.api_version.strip("/")
    return f"{base}/api/{ver}/bots/webhook/{webhook_secret}"


def _normalize_symbol(raw: str) -> str:
    s = raw.upper().replace("/", "").strip()
    if ":" in s:
        s = s.split(":")[-1]
    return s


def normalize_webhook_payload(payload: Any) -> dict[str, Any]:
    """
    TradingView sometimes sends JSON as a string in `raw`, or a single-element array.
    Normalize to a flat dict so parse_tradingview_payload sees action/ticker/price.
    """
    if isinstance(payload, list):
        if len(payload) >= 1 and isinstance(payload[0], dict):
            payload = payload[0]
        else:
            return {"raw": str(payload)}
    if not isinstance(payload, dict):
        return {"raw": str(payload)}
    out: dict[str, Any] = dict(payload)
    raw = out.get("raw")
    if isinstance(raw, str):
        s = raw.strip()
        if s.startswith("{") and s.endswith("}"):
            try:
                inner = json.loads(s)
                if isinstance(inner, dict):
                    merged = {**out, **inner}
                    merged.pop("raw", None)
                    return merged
            except json.JSONDecodeError:
                pass
    return out


def _first_float(payload: dict[str, Any], *keys: str, default: float = 0.0) -> float:
    for k in keys:
        if k not in payload:
            continue
        v = payload[k]
        if v is None:
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return default


@dataclass
class ParsedAlert:
    action: str
    instrument: str
    lot_size: float
    price: float
    sl: float
    tp: float


def parse_tradingview_payload(payload: dict[str, Any]) -> ParsedAlert:
    """
    Normalize TradingView alert JSON and common variants.
    Supports flat keys + nested strategy.order.* / syminfo.*
    """
    strat = payload.get("strategy")
    if not isinstance(strat, dict):
        strat = {}

    syminfo = payload.get("syminfo")
    if not isinstance(syminfo, dict):
        syminfo = {}

    action = (
        payload.get("action")
        or payload.get("side")
        or strat.get("order_action")
        or strat.get("action")
        or ""
    )
    action = str(action).lower().strip()
    if action in ("long", "entrylong"):
        action = "buy"
    elif action in ("short", "entryshort"):
        action = "sell"

    raw_symbol = (
        payload.get("ticker")
        or payload.get("symbol")
        or payload.get("pair")
        or payload.get("instrument")
        or syminfo.get("ticker")
        or syminfo.get("prefix")  # TV syminfo
        or payload.get("market")
        or ""
    )
    instrument = _normalize_symbol(str(raw_symbol)) if raw_symbol else ""

    lot_size = _first_float(payload, "lot_size", "contracts", "qty", "quantity")
    price = _first_float(payload, "price", "close", "open", "entry")
    sl = _first_float(payload, "sl", "stop_loss", "stop")
    tp = _first_float(payload, "tp", "take_profit", "target")

    return ParsedAlert(
        action=action,
        instrument=instrument,
        lot_size=lot_size,
        price=price,
        sl=sl,
        tp=tp,
    )


def merge_bot_alert_defaults(parsed: ParsedAlert, bot: Bot) -> ParsedAlert:
    """
    Price alerts: no strategy order → use bot.default_order_action.
    Missing ticker → use bot.fixed_symbol (e.g. single-symbol gold bot).
    """
    action = parsed.action
    if not action and getattr(bot, "default_order_action", None):
        da = str(bot.default_order_action).lower().strip()
        if da in ("buy", "sell"):
            action = da

    instrument = parsed.instrument
    if not instrument and getattr(bot, "fixed_symbol", None):
        fs = str(bot.fixed_symbol).strip()
        if fs:
            instrument = _normalize_symbol(fs)

    return ParsedAlert(
        action=action,
        instrument=instrument,
        lot_size=parsed.lot_size,
        price=parsed.price,
        sl=parsed.sl,
        tp=parsed.tp,
    )


def tradingview_alert_json_examples(bot: Bot, webhook_url: str) -> dict[str, str]:
    """Ready-to-paste JSON for TradingView alert → Message field (Webhook URL = webhook_url)."""
    lot = bot.default_lot_size
    has_def = bool(
        bot.default_order_action
        and str(bot.default_order_action).lower().strip() in ("buy", "sell")
    )
    if bot.fixed_symbol:
        ticker_val = f'"{_normalize_symbol(bot.fixed_symbol)}"'
    else:
        ticker_val = '"{{ticker}}"'

    price_val = "{{close}}"

    if has_def:
        minimal = (
            "{\n"
            f'  "ticker": {ticker_val},\n'
            f'  "price": {price_val},\n'
            f'  "lot_size": {lot}\n'
            "}"
        )
    else:
        minimal = (
            "{\n"
            '  "action": "buy",\n'
            f'  "ticker": {ticker_val},\n'
            f'  "price": {price_val},\n'
            f'  "lot_size": {lot}\n'
            "}"
        )

    act = str(bot.default_order_action).lower().strip() if getattr(bot, "default_order_action", None) else "buy"
    if act not in ("buy", "sell"):
        act = "buy"
    full = (
        "{\n"
        f'  "action": "{act}",\n'
        f'  "ticker": {ticker_val},\n'
        f'  "price": {price_val},\n'
        f'  "lot_size": {lot},\n'
        '  "sl": 0,\n'
        '  "tp": 0\n'
        "}"
    )

    return {
        "webhook_url": webhook_url,
        "message_minimal_json": minimal,
        "message_full_json": full,
        "hint": (
            "TradingView cannot call localhost. "
            'If you see "Only port 80 is allowed for HTTP", use HTTPS public URL: '
            "run `ngrok http 8000`, set PUBLIC_API_BASE_URL=https://your-subdomain.ngrok-free.app in server .env, restart API, "
            "then copy the webhook URL again from the dashboard. "
            "Alert → Notifications → Webhook URL + paste message_minimal_json in Message."
        ),
    }


async def fetch_reference_price(symbol: str) -> Optional[float]:
    """
    Last trade price from InfoWay when alert omits price (requires INFOWAY_API_KEY).
    """
    if not settings.infoway_api_key or not symbol:
        return None
    sym = symbol.upper().strip()
    headers = {"apiKey": settings.infoway_api_key, "Content-Type": "application/json"}
    base = settings.infoway_rest_base.rstrip("/")

    async def _try(url: str) -> Optional[float]:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, headers=headers)
                data = res.json()
            if data.get("ret") != 200 or not data.get("data"):
                return None
            row = data["data"][0]
            p = row.get("p")
            if p is None:
                return None
            v = float(p)
            return v if v > 0 else None
        except Exception:
            return None

    # Forex/metals batch_trade
    v = await _try(f"{base}/common/batch_trade/{sym}")
    if v is not None:
        return v
    # Crypto often needs USDT suffix
    if sym.endswith("USD") and not sym.endswith("USDT"):
        v = await _try(f"{base}/crypto/batch_trade/{sym}T")
        if v is not None:
            return v
    return await _try(f"{base}/crypto/batch_trade/{sym}")


def compute_effective_lot_size(
    bot: Bot,
    account: TradingAccount,
    instrument: Instrument,
    price: float,
    stop_loss: float,
    requested_lot: float,
) -> float:
    """
    Fixed lots from alert (capped), or risk % of equity when SL distance is known.
    """
    req = min(max(requested_lot, instrument.min_lot), bot.max_lot_size, instrument.max_lot)
    if bot.risk_per_trade_pct <= 0:
        return req

    if stop_loss <= 0 or price <= 0:
        return req

    sl_dist = abs(price - stop_loss)
    if sl_dist < instrument.pip_size:
        return req

    risk_amt = max(0.0, account.equity) * (bot.risk_per_trade_pct / 100.0)
    loss_per_unit_lot = instrument.lot_size * sl_dist
    if loss_per_unit_lot <= 0:
        return req

    lots = risk_amt / loss_per_unit_lot
    step = instrument.lot_step or 0.01
    lots = max(instrument.min_lot, min(lots, bot.max_lot_size, instrument.max_lot))
    # snap to step
    steps = round(lots / step)
    lots = max(instrument.min_lot, steps * step)
    return min(lots, bot.max_lot_size, instrument.max_lot)
