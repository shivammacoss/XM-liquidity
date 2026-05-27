"""
XMLiquidity — Copy Trading + PAMM Router
Masters, subscriptions, signal history, PAMM investments.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.copy_trading import CopyMaster, CopySubscription, PAMMAccount, MasterStatus, PAMMStatus
from app.models.account import TradingAccount

router = APIRouter(prefix="/copy-trading", tags=["Copy Trading & PAMM"])


# --- Copy Trading ---

class ApplyMasterRequest(BaseModel):
    account_id: str
    charge_per_trade: float = Field(0.0, ge=0)


@router.post("/apply-master", status_code=201)
async def apply_as_master(data: ApplyMasterRequest, user: User = Depends(get_current_user)):
    """Apply to become a copy trading master. Admin must approve."""
    account = await TradingAccount.get(data.account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found")

    existing = await CopyMaster.find_one(CopyMaster.user_id == user.id, CopyMaster.status != "rejected")
    if existing:
        raise HTTPException(status_code=400, detail="You already have a master application")

    master = CopyMaster(
        user_id=user.id,
        account_id=account.id,
        charge_per_trade=data.charge_per_trade,
    )
    await master.insert()
    return {"id": str(master.id), "status": "pending", "message": "Application submitted. Awaiting admin approval."}


@router.get("/masters")
async def list_masters(user: User = Depends(get_current_user)):
    """List all approved copy trading masters."""
    masters = await CopyMaster.find(CopyMaster.status == MasterStatus.APPROVED, CopyMaster.is_active == True).to_list()
    result = []
    for m in masters:
        u = await User.get(m.user_id)
        acct = await TradingAccount.get(m.account_id)
        result.append({
            "id": str(m.id),
            "master_name": u.name if u else "Unknown",
            "account_number": acct.account_number if acct else "",
            "total_pnl": round(m.total_pnl, 2),
            "total_trades": m.total_trades,
            "win_rate": round(m.win_rate, 2),
            "subscriber_count": m.subscriber_count,
            "charge_per_trade": m.charge_per_trade,
        })
    return result


class SubscribeRequest(BaseModel):
    master_id: str
    account_id: str
    lot_multiplier: float = Field(1.0, gt=0, le=10)


@router.post("/subscribe", status_code=201)
async def subscribe_to_master(data: SubscribeRequest, user: User = Depends(get_current_user)):
    """Subscribe to a copy trading master."""
    master = await CopyMaster.get(data.master_id)
    if not master or master.status != MasterStatus.APPROVED:
        raise HTTPException(status_code=404, detail="Master not found or not approved")

    account = await TradingAccount.get(data.account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    if not account.is_funded:
        raise HTTPException(status_code=400, detail="Account must be funded first")

    existing = await CopySubscription.find_one(
        CopySubscription.follower_id == user.id,
        CopySubscription.master_id == master.id,
        CopySubscription.is_active == True,
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already subscribed to this master")

    sub = CopySubscription(
        follower_id=user.id,
        master_id=master.id,
        follower_account_id=account.id,
        lot_multiplier=data.lot_multiplier,
    )
    await sub.insert()

    master.subscriber_count += 1
    await master.save()

    return {"id": str(sub.id), "message": "Subscribed successfully"}


@router.delete("/unsubscribe/{subscription_id}")
async def unsubscribe(subscription_id: str, user: User = Depends(get_current_user)):
    """Unsubscribe from a copy trading master."""
    sub = await CopySubscription.get(subscription_id)
    if not sub or sub.follower_id != user.id:
        raise HTTPException(status_code=404, detail="Subscription not found")

    sub.is_active = False
    await sub.save()

    master = await CopyMaster.get(sub.master_id)
    if master:
        master.subscriber_count = max(0, master.subscriber_count - 1)
        await master.save()

    return {"message": "Unsubscribed successfully"}


@router.get("/my-subscriptions")
async def my_subscriptions(user: User = Depends(get_current_user)):
    """List user's active copy trading subscriptions."""
    subs = await CopySubscription.find(
        CopySubscription.follower_id == user.id, CopySubscription.is_active == True
    ).to_list()
    result = []
    for s in subs:
        master = await CopyMaster.get(s.master_id)
        master_user = await User.get(master.user_id) if master else None
        result.append({
            "id": str(s.id),
            "master_name": master_user.name if master_user else "Unknown",
            "lot_multiplier": s.lot_multiplier,
            "total_copied_trades": s.total_copied_trades,
            "total_pnl": round(s.total_pnl, 2),
            "created_at": s.created_at.isoformat(),
        })
    return result


# --- PAMM ---

class InvestPAMMRequest(BaseModel):
    pamm_id: str
    amount: float = Field(..., gt=0)


@router.get("/pamm")
async def list_pamm_accounts(user: User = Depends(get_current_user)):
    """List all approved PAMM accounts available for investment."""
    pamms = await PAMMAccount.find(PAMMAccount.status == PAMMStatus.APPROVED, PAMMAccount.is_active == True).to_list()
    result = []
    for p in pamms:
        manager = await User.get(p.manager_id)
        result.append({
            "id": str(p.id),
            "manager_name": manager.name if manager else "Unknown",
            "total_pool": round(p.total_pool, 2),
            "profit_share_pct": p.profit_share_pct,
            "total_pnl": round(p.total_pnl, 2),
            "total_trades": p.total_trades,
            "investor_count": len(p.investors),
        })
    return result


@router.post("/pamm/invest", status_code=201)
async def invest_in_pamm(data: InvestPAMMRequest, user: User = Depends(get_current_user)):
    """Invest funds from wallet into a PAMM account."""
    pamm = await PAMMAccount.get(data.pamm_id)
    if not pamm or pamm.status != PAMMStatus.APPROVED:
        raise HTTPException(status_code=404, detail="PAMM account not found")

    from app.models.wallet import Wallet
    wallet = await Wallet.find_one(Wallet.user_id == user.id)
    if not wallet or wallet.balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    # Deduct from wallet
    wallet.balance -= data.amount
    wallet.updated_at = datetime.now(timezone.utc)
    await wallet.save()

    # Add to PAMM pool
    pamm.total_pool += data.amount
    existing_investor = None
    for inv in pamm.investors:
        if inv.get("user_id") == str(user.id):
            existing_investor = inv
            break

    if existing_investor:
        existing_investor["amount_invested"] += data.amount
    else:
        pamm.investors.append({
            "user_id": str(user.id),
            "amount_invested": data.amount,
            "share_pct": 0,  # Recalculated
            "joined_at": datetime.now(timezone.utc).isoformat(),
            "total_profit": 0,
        })

    # Recalculate share percentages
    for inv in pamm.investors:
        inv["share_pct"] = round((inv["amount_invested"] / pamm.total_pool) * 100, 2)

    await pamm.save()

    return {"message": f"Invested ${data.amount} in PAMM account", "new_pool": round(pamm.total_pool, 2)}
