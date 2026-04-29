"""
SwisTrade — Prop Challenges Router (User-facing)
Browse available challenges, purchase (multi-tier), view active props, dashboard,
insights, withdraw profit.

Mirrors bharat_funded user privileges:
  GET  /prop/status                       — public mode + display name
  GET  /prop/available                    — flat catalog (legacy single-tier)
  GET  /prop/challenges                   — admin-created multi-tier catalog
  POST /prop/purchase                     — legacy single-tier buy
  POST /prop/buy                          — multi-tier buy (challenge_id + tier_index)
  GET  /prop/my-challenges                — user's prop accounts (legacy shape)
  GET  /prop/my-accounts                  — enriched: floating P&L, live equity
  GET  /prop/{prop_id}                    — legacy detail view
  GET  /prop/account/{prop_id}/dashboard  — FTMO-style dashboard
  GET  /prop/account/{prop_id}/insights   — equity curve + analytics
  POST /prop/withdraw                     — request payout (pending Transaction)
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.prop import (
    PropAccount, PropSettings, PropChallenge, PropType, PropAccountStatus,
)
from app.models.account import TradingAccount, AccountType, generate_account_number
from app.models.wallet import Wallet
from app.models.transaction import Transaction, TransactionType, TransactionMethod, TransactionStatus
from app.services import prop_engine

router = APIRouter(prefix="/prop", tags=["Prop Challenges"])


# --------------------------------------------------------------------------
# PUBLIC STATUS  (open to anyone — no auth)
# --------------------------------------------------------------------------

@router.get("/status")
async def public_status():
    """Whether challenge mode is on + display name. No auth required."""
    s = await PropSettings.find_one(PropSettings.admin_id == None)  # noqa: E711
    enabled = bool(s.challenge_mode_enabled) if s else False
    if not enabled:
        active = await PropChallenge.find(PropChallenge.is_active == True).count()
        enabled = active > 0
    return {
        "enabled": enabled,
        "display_name": s.display_name if s else "Prop Trading Challenge",
        "description": s.description if s else "",
    }


# --------------------------------------------------------------------------
# CATALOG
# --------------------------------------------------------------------------

@router.get("/available")
async def list_available_challenges(user: User = Depends(get_current_user)):
    """Legacy catalog from PropSettings (single-tier rows). Kept for back-compat."""
    settings = await PropSettings.find(
        PropSettings.is_active == True, PropSettings.account_size > 0,
    ).sort("account_size").to_list()
    return [
        {
            "id": str(s.id),
            "prop_type": s.prop_type.value if s.prop_type else None,
            "account_size": s.account_size,
            "price": s.price,
            "phases_count": s.phases_count,
            "rules": {
                "max_daily_loss_pct": s.max_daily_loss_pct,
                "max_total_loss_pct": s.max_total_loss_pct,
                "profit_target_pct": s.profit_target_pct,
                "min_trading_days": s.min_trading_days,
                "max_trading_days": s.max_trading_days,
                "sl_required": s.sl_required,
                "tp_required": s.tp_required,
                "max_lot_size": s.max_lot_size,
                "max_leverage": s.max_leverage,
                "daily_trade_limit": s.daily_trade_limit,
                "max_open_trades": s.max_open_trades,
            },
        }
        for s in settings
    ]


@router.get("/challenges")
async def list_challenges():
    """Admin-created challenges with multi-tier pricing. Public — anyone can browse."""
    challenges = await PropChallenge.find(PropChallenge.is_active == True).sort("sort_order", "account_size").to_list()
    return {
        "challenges": [
            {
                "id": str(c.id),
                "name": c.name,
                "description": c.description,
                "prop_type": c.prop_type.value,
                "steps_count": c.steps_count,
                "currency": c.currency,
                "account_size": c.account_size,
                "price": c.price,
                "tiers": [t.model_dump() for t in (c.tiers or [])],
                "rules": {
                    "max_daily_loss_pct": c.rules.get("max_daily_loss_pct"),
                    "max_total_loss_pct": c.rules.get("max_total_loss_pct"),
                    "profit_target_phase1_pct": c.rules.get("profit_target_phase1_pct"),
                    "profit_target_phase2_pct": c.rules.get("profit_target_phase2_pct"),
                    "profit_target_instant_pct": c.rules.get("profit_target_instant_pct"),
                    "max_leverage": c.rules.get("max_leverage"),
                    "challenge_expiry_days": c.rules.get("challenge_expiry_days"),
                    "stop_loss_required": c.rules.get("stop_loss_required"),
                    "take_profit_required": c.rules.get("take_profit_required"),
                    "trading_days_required": c.rules.get("trading_days_required"),
                },
                "funded_settings": {
                    "profit_split_pct": c.funded_settings.get("profit_split_pct"),
                    "withdrawal_cooldown_days": c.funded_settings.get("withdrawal_cooldown_days"),
                },
                "sort_order": c.sort_order,
            } for c in challenges
        ]
    }


# --------------------------------------------------------------------------
# PURCHASE
# --------------------------------------------------------------------------

class PurchasePropRequest(BaseModel):
    prop_settings_id: str


@router.post("/purchase", status_code=201)
async def purchase_prop_challenge(data: PurchasePropRequest, user: User = Depends(get_current_user)):
    """Legacy purchase from PropSettings catalog row. New UI should call /buy."""
    settings = await PropSettings.get(data.prop_settings_id)
    if not settings or not settings.is_active:
        raise HTTPException(status_code=404, detail="Prop challenge not found or inactive")

    wallet = await Wallet.find_one(Wallet.user_id == user.id)
    if not wallet or wallet.balance < settings.price:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. Need ${settings.price}")

    wallet.balance -= settings.price
    wallet.updated_at = datetime.now(timezone.utc)
    await wallet.save()

    txn = Transaction(
        user_id=user.id,
        type=TransactionType.PROP_PURCHASE,
        method=TransactionMethod.INTERNAL,
        status=TransactionStatus.COMPLETED,
        amount=settings.price,
    )
    await txn.insert()

    trading_acct = TradingAccount(
        user_id=user.id,
        account_type=AccountType.STANDARD,
        balance=settings.account_size,
        equity=settings.account_size,
        free_margin=settings.account_size,
        leverage=settings.max_leverage,
        is_funded=True,
        initial_deposit=settings.account_size,
        is_prop_account=True,
    )
    while await TradingAccount.find_one(TradingAccount.account_number == trading_acct.account_number):
        trading_acct.account_number = generate_account_number()
    await trading_acct.insert()

    rules_snapshot = {
        "max_daily_loss_pct": settings.max_daily_loss_pct,
        "max_total_loss_pct": settings.max_total_loss_pct,
        "profit_target_pct": settings.profit_target_pct,
        "min_trading_days": settings.min_trading_days,
        "max_trading_days": settings.max_trading_days,
        "sl_required": settings.sl_required,
        "tp_required": settings.tp_required,
        "max_lot_size": settings.max_lot_size,
        "max_leverage": settings.max_leverage,
        "partial_close_required": settings.partial_close_required,
        "daily_trade_limit": settings.daily_trade_limit,
        "max_open_trades": settings.max_open_trades,
    }

    prop = PropAccount(
        user_id=user.id,
        prop_type=settings.prop_type,
        account_size=settings.account_size,
        price_paid=settings.price,
        total_phases=settings.phases_count,
        trading_account_id=trading_acct.id,
        risk_rules=rules_snapshot,
        sub_wallet_balance=settings.account_size,
        sub_wallet_equity=settings.account_size,
        sub_wallet_free_margin=settings.account_size,
        phase_start_balance=settings.account_size,
        phases=[{
            "phase_num": 1,
            "status": "active",
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": None,
            "starting_balance": settings.account_size,
            "current_balance": settings.account_size,
            "trading_account_id": str(trading_acct.id),
        }],
    )
    await prop.insert()

    trading_acct.prop_account_id = prop.id
    await trading_acct.save()
    txn.prop_account_id = prop.id
    await txn.save()

    return {
        "prop_id": str(prop.id),
        "trading_account_id": str(trading_acct.id),
        "account_number": trading_acct.account_number,
        "account_size": settings.account_size,
        "prop_type": settings.prop_type.value if settings.prop_type else None,
        "phases": settings.phases_count,
        "rules": rules_snapshot,
        "message": "Prop challenge purchased successfully!",
    }


class BuyChallengeRequest(BaseModel):
    challenge_id: str
    tier_index: Optional[int] = None


@router.post("/buy", status_code=201)
async def buy_challenge(data: BuyChallengeRequest, user: User = Depends(get_current_user)):
    """Multi-tier buy. Picks tier_index from challenge.tiers; falls back to legacy single-tier."""
    try:
        result = await prop_engine.buy_challenge(user.id, data.challenge_id, data.tier_index)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    prop = result["account"]
    challenge = result["challenge"]
    return {
        "message": "Challenge purchased successfully!",
        "account": {
            "id": str(prop.id),
            "prop_type": prop.prop_type.value,
            "account_size": prop.account_size,
            "price_paid": prop.price_paid,
            "status": prop.status.value,
            "current_phase": prop.current_phase,
            "total_phases": prop.total_phases,
            "expires_at": prop.expires_at.isoformat() if prop.expires_at else None,
        },
        "challenge": {"name": challenge.name, "fund_size": prop.account_size},
    }


# --------------------------------------------------------------------------
# USER ACCOUNT VIEWS
# --------------------------------------------------------------------------

@router.get("/my-challenges")
async def list_my_challenges(
    user: User = Depends(get_current_user),
    status_filter: str = Query(None, alias="status"),
):
    """Legacy listing — kept for back-compat with existing clients."""
    query = PropAccount.find(PropAccount.user_id == user.id)
    if status_filter:
        query = query.find(PropAccount.status == status_filter)
    props = await query.sort("-created_at").to_list()
    result = []
    for p in props:
        acct = await TradingAccount.get(p.trading_account_id) if p.trading_account_id else None
        result.append({
            "id": str(p.id),
            "prop_type": p.prop_type.value,
            "account_size": p.account_size,
            "price_paid": p.price_paid,
            "status": p.status.value,
            "current_phase": p.current_phase,
            "total_phases": p.total_phases,
            "phases": p.phases,
            "risk_rules": p.risk_rules,
            "is_blown": p.is_blown,
            "blown_reason": p.blown_reason,
            "trading_account": {
                "id": str(acct.id),
                "account_number": acct.account_number,
                "balance": acct.balance,
                "equity": acct.equity,
            } if acct else None,
            "purchased_at": p.purchased_at.isoformat(),
        })
    return result


@router.get("/my-accounts")
async def list_my_accounts(user: User = Depends(get_current_user)):
    """Enriched listing with floating P&L from open trades on the linked trading account."""
    accounts = await PropAccount.find(PropAccount.user_id == user.id).sort("-created_at").to_list()
    enriched = []
    for a in accounts:
        challenge = await PropChallenge.get(a.challenge_id) if a.challenge_id else None
        floating_pnl = 0.0
        open_count = 0
        if a.trading_account_id:
            from app.models.trade import Trade, TradeStatus
            open_trades = await Trade.find(
                Trade.account_id == a.trading_account_id,
                Trade.status == TradeStatus.OPEN,
            ).to_list()
            floating_pnl = sum(t.pnl or t.unrealized_pnl or 0 for t in open_trades)
            open_count = len(open_trades)

        balance = a.sub_wallet_balance or 0
        live_equity = balance + floating_pnl
        realised_pnl = balance - (a.account_size or 0)

        enriched.append({
            "id": str(a.id),
            "challenge": {
                "id": str(challenge.id), "name": challenge.name,
                "steps_count": challenge.steps_count,
                "rules": challenge.rules,
                "funded_settings": challenge.funded_settings,
            } if challenge else None,
            "prop_type": a.prop_type.value,
            "status": a.status.value,
            "current_phase": a.current_phase,
            "total_phases": a.total_phases,
            "account_size": a.account_size,
            "balance": balance,
            "floating_pnl": round(floating_pnl, 2),
            "live_equity": round(live_equity, 2),
            "realised_pnl": round(realised_pnl, 2),
            "total_pnl": round(realised_pnl + floating_pnl, 2),
            "open_count": open_count,
            "current_profit_pct": a.current_profit_pct,
            "current_daily_drawdown_pct": a.current_daily_drawdown_pct,
            "current_overall_drawdown_pct": a.current_overall_drawdown_pct,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
            "created_at": a.created_at.isoformat(),
        })
    return {"accounts": enriched}


@router.get("/account/{prop_id}/dashboard")
async def get_account_dashboard(prop_id: str, user: User = Depends(get_current_user)):
    """FTMO-style dashboard — balance/equity, drawdown bars, profit progress, objectives summary."""
    dashboard = await prop_engine.get_account_dashboard(prop_id, user.id)
    if not dashboard:
        raise HTTPException(404, "Account not found")
    return dashboard


@router.get("/account/{prop_id}/insights")
async def get_account_insights(prop_id: str, user: User = Depends(get_current_user)):
    """Equity curve, daily breakdown, performance metrics, objectives, consistency."""
    insights = await prop_engine.get_account_insights(prop_id, user.id)
    if not insights:
        raise HTTPException(404, "Account not found")
    return insights


# --------------------------------------------------------------------------
# WITHDRAWAL
# --------------------------------------------------------------------------

class WithdrawRequest(BaseModel):
    prop_id: str


@router.post("/withdraw")
async def withdraw_profit(data: WithdrawRequest, user: User = Depends(get_current_user)):
    """Funded-account profit payout. Creates a pending Transaction; admin approves to credit Wallet."""
    try:
        result = await prop_engine.request_withdrawal(data.prop_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "pending": True,
        "message": f"Payout request of {result['requested_amount']:.2f} submitted for admin approval",
        "transaction_id": result["transaction_id"],
        "requested_amount": result["requested_amount"],
        "profit": result["profit"],
        "split_pct": result["split_pct"],
    }


# --------------------------------------------------------------------------
# LEGACY DETAIL  (kept last — catch-all path must be after specific paths)
# --------------------------------------------------------------------------

@router.get("/{prop_id}")
async def get_prop_detail(prop_id: str, user: User = Depends(get_current_user)):
    prop = await PropAccount.get(prop_id)
    if not prop or prop.user_id != user.id:
        raise HTTPException(status_code=404, detail="Prop challenge not found")

    acct = await TradingAccount.get(prop.trading_account_id) if prop.trading_account_id else None
    from app.models.trade import Trade, TradeStatus
    trades = await Trade.find(
        Trade.account_id == prop.trading_account_id,
    ).sort("-open_time").limit(50).to_list() if prop.trading_account_id else []

    return {
        "id": str(prop.id),
        "prop_type": prop.prop_type.value,
        "account_size": prop.account_size,
        "status": prop.status.value,
        "current_phase": prop.current_phase,
        "total_phases": prop.total_phases,
        "phases": prop.phases,
        "risk_rules": prop.risk_rules,
        "is_blown": prop.is_blown,
        "blown_reason": prop.blown_reason,
        "blown_at": prop.blown_at.isoformat() if prop.blown_at else None,
        "passed_at": prop.passed_at.isoformat() if prop.passed_at else None,
        "expires_at": prop.expires_at.isoformat() if prop.expires_at else None,
        "violations": prop.violations,
        "account": {
            "balance": acct.balance,
            "equity": acct.equity,
            "total_trades": acct.total_trades,
            "total_pnl": round(acct.total_pnl, 2),
        } if acct else None,
        "recent_trades": [
            {
                "instrument": t.instrument,
                "direction": t.direction.value,
                "lot_size": t.lot_size,
                "pnl": round(t.pnl, 2),
                "status": t.status.value,
                "open_time": t.open_time.isoformat(),
            } for t in trades
        ],
    }
