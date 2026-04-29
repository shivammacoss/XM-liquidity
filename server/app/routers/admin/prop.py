"""
SwisTrade — Admin Prop Challenge Router
Brings bharat_funded admin privileges to SwisTrade:
  - Per-admin master settings (challenge_mode_enabled, display, T&C)
  - Challenge catalog CRUD (multi-tier pricing)
  - Account list, force-pass, force-fail, extend-time, reset
  - Payout queue (list pending, approve with custom amount + cooldown override, reject)
  - Prop dashboard stats

All endpoints require sub-admin or super-admin (server-side role check).
"""

from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.middleware.auth import get_admin_user, get_super_admin
from app.models.user import User
from app.models.prop import (
    PropAccount, PropAccountStatus, PropChallenge, PropSettings,
    PropType, PropTier,
)
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.admin import AdminAuditLog
from app.services import prop_engine

router = APIRouter(prefix="/admin/prop", tags=["Admin · Prop Challenges"])


# --------------------------------------------------------------------------
# SETTINGS (master toggle, display strings, T&C)
# --------------------------------------------------------------------------

@router.get("/settings")
async def get_settings(admin: User = Depends(get_admin_user)):
    s = await prop_engine.get_or_create_prop_settings(admin.id)
    return {
        "challenge_mode_enabled": s.challenge_mode_enabled,
        "display_name": s.display_name,
        "description": s.description,
        "terms_and_conditions": s.terms_and_conditions,
        "auto_close_at_market_close": s.auto_close_at_market_close,
    }


class UpdateSettingsRequest(BaseModel):
    challenge_mode_enabled: Optional[bool] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    auto_close_at_market_close: Optional[bool] = None


@router.put("/settings")
async def update_settings(data: UpdateSettingsRequest, admin: User = Depends(get_admin_user)):
    s = await prop_engine.get_or_create_prop_settings(admin.id)
    payload = data.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(s, k, v)
    s.updated_at = datetime.now(timezone.utc)
    await s.save()
    return {"message": "Settings updated", "settings": payload}


# --------------------------------------------------------------------------
# CHALLENGE CATALOG (CRUD with multi-tier pricing)
# --------------------------------------------------------------------------

class ChallengeTierIn(BaseModel):
    account_size: float
    price: float
    label: str = ""
    is_popular: bool = False


class CreateChallengeRequest(BaseModel):
    name: str
    description: str = ""
    prop_type: str = Field("two_step", pattern="^(one_step|two_step|instant_fund)$")
    steps_count: int = Field(2, ge=0, le=2)
    currency: str = "USD"
    account_size: float = 0.0
    price: float = 0.0
    tiers: List[ChallengeTierIn] = []
    rules: dict = {}
    funded_settings: dict = {}
    is_active: bool = True
    sort_order: int = 0


@router.post("/challenges", status_code=201)
async def create_challenge(data: CreateChallengeRequest, admin: User = Depends(get_admin_user)):
    challenge = PropChallenge(
        admin_id=admin.id,
        name=data.name,
        description=data.description,
        prop_type=PropType(data.prop_type),
        steps_count=data.steps_count,
        currency=data.currency,
        account_size=data.account_size,
        price=data.price,
        tiers=[PropTier(**t.model_dump()) for t in data.tiers],
        is_active=data.is_active,
        sort_order=data.sort_order,
    )
    if data.rules:
        challenge.rules = {**challenge.rules, **data.rules}
    if data.funded_settings:
        challenge.funded_settings = {**challenge.funded_settings, **data.funded_settings}
    await challenge.insert()

    log = AdminAuditLog(
        admin_id=admin.id, action_type="create_challenge",
        entity_type="prop_challenge", entity_id=str(challenge.id),
        changes=[{"field": "name", "old_value": None, "new_value": challenge.name}],
    )
    await log.insert()
    return {"message": "Challenge created", "challenge_id": str(challenge.id)}


@router.get("/challenges")
async def list_challenges(admin: User = Depends(get_admin_user)):
    challenges = await PropChallenge.find(PropChallenge.admin_id == admin.id).sort("sort_order", "account_size").to_list()
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
                "rules": c.rules,
                "funded_settings": c.funded_settings,
                "is_active": c.is_active,
                "sort_order": c.sort_order,
                "created_at": c.created_at.isoformat(),
            } for c in challenges
        ]
    }


class UpdateChallengeRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prop_type: Optional[str] = Field(None, pattern="^(one_step|two_step|instant_fund)$")
    steps_count: Optional[int] = Field(None, ge=0, le=2)
    currency: Optional[str] = None
    account_size: Optional[float] = None
    price: Optional[float] = None
    tiers: Optional[List[ChallengeTierIn]] = None
    rules: Optional[dict] = None
    funded_settings: Optional[dict] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


@router.put("/challenges/{challenge_id}")
async def update_challenge(
    challenge_id: str,
    data: UpdateChallengeRequest,
    admin: User = Depends(get_admin_user),
):
    challenge = await PropChallenge.get(challenge_id)
    if not challenge:
        raise HTTPException(404, "Challenge not found")
    if challenge.admin_id and challenge.admin_id != admin.id:
        raise HTTPException(403, "Access denied")

    payload = data.model_dump(exclude_unset=True)
    if "prop_type" in payload:
        payload["prop_type"] = PropType(payload["prop_type"])
    if "tiers" in payload:
        payload["tiers"] = [PropTier(**t) for t in (payload["tiers"] or [])]
    if "rules" in payload:
        payload["rules"] = {**(challenge.rules or {}), **(payload["rules"] or {})}
    if "funded_settings" in payload:
        payload["funded_settings"] = {**(challenge.funded_settings or {}), **(payload["funded_settings"] or {})}

    for k, v in payload.items():
        setattr(challenge, k, v)
    challenge.updated_at = datetime.now(timezone.utc)
    await challenge.save()
    return {"message": "Challenge updated"}


@router.delete("/challenges/{challenge_id}")
async def delete_challenge(challenge_id: str, admin: User = Depends(get_admin_user)):
    challenge = await PropChallenge.get(challenge_id)
    if not challenge:
        raise HTTPException(404, "Challenge not found")
    if challenge.admin_id and challenge.admin_id != admin.id:
        raise HTTPException(403, "Access denied")
    in_use = await PropAccount.find(PropAccount.challenge_id == challenge.id).count()
    if in_use > 0:
        raise HTTPException(400, f"Cannot delete. {in_use} accounts are using this challenge.")
    await challenge.delete()
    return {"message": "Challenge deleted"}


# --------------------------------------------------------------------------
# ACCOUNTS (list, force-actions, reset)
# --------------------------------------------------------------------------

@router.get("/accounts")
async def list_accounts(
    status: Optional[str] = Query(None),
    challenge_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_admin_user),
):
    query = PropAccount.find()
    if status:
        query = query.find(PropAccount.status == status)
    if challenge_id:
        query = query.find(PropAccount.challenge_id == challenge_id)

    total = await query.count()
    skip = (page - 1) * per_page
    accounts = await query.sort("-created_at").skip(skip).limit(per_page).to_list()

    enriched = []
    for a in accounts:
        u = await User.get(a.user_id)
        challenge = await PropChallenge.get(a.challenge_id) if a.challenge_id else None
        enriched.append({
            "id": str(a.id),
            "user": {
                "id": str(u.id), "name": u.name, "email": u.email,
            } if u else None,
            "challenge": {
                "id": str(challenge.id), "name": challenge.name,
                "account_size": a.account_size, "steps_count": challenge.steps_count,
            } if challenge else {"account_size": a.account_size, "steps_count": a.total_phases},
            "status": a.status.value,
            "current_phase": a.current_phase,
            "total_phases": a.total_phases,
            "current_balance": a.sub_wallet_balance,
            "current_equity": a.sub_wallet_equity,
            "current_profit_pct": a.current_profit_pct,
            "current_daily_drawdown_pct": a.current_daily_drawdown_pct,
            "current_overall_drawdown_pct": a.current_overall_drawdown_pct,
            "violations_count": len(a.violations or []),
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
            "created_at": a.created_at.isoformat(),
        })
    return {"accounts": enriched, "total": total, "page": page}


@router.post("/accounts/{prop_id}/force-pass")
async def force_pass(prop_id: str, admin: User = Depends(get_admin_user)):
    try:
        prop = await prop_engine.force_pass(prop_id, admin.id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    log = AdminAuditLog(
        admin_id=admin.id, action_type="force_pass_prop",
        entity_type="prop_account", entity_id=str(prop.id),
        changes=[{"field": "status", "old_value": None, "new_value": "passed"}],
    )
    await log.insert()
    return {"message": "Challenge force-passed", "account_id": str(prop.id)}


class ForceFailRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/accounts/{prop_id}/force-fail")
async def force_fail(prop_id: str, data: ForceFailRequest, admin: User = Depends(get_admin_user)):
    try:
        prop = await prop_engine.force_fail(prop_id, admin.id, data.reason or "")
    except ValueError as e:
        raise HTTPException(400, str(e))
    log = AdminAuditLog(
        admin_id=admin.id, action_type="force_fail_prop",
        entity_type="prop_account", entity_id=str(prop.id),
        changes=[{"field": "status", "old_value": None, "new_value": "blown"}],
    )
    await log.insert()
    return {"message": "Challenge force-failed", "account_id": str(prop.id)}


class ExtendTimeRequest(BaseModel):
    days: int = Field(..., gt=0)


@router.post("/accounts/{prop_id}/extend-time")
async def extend_time(prop_id: str, data: ExtendTimeRequest, admin: User = Depends(get_admin_user)):
    try:
        prop = await prop_engine.extend_time(prop_id, admin.id, data.days)
    except ValueError as e:
        raise HTTPException(400, str(e))
    log = AdminAuditLog(
        admin_id=admin.id, action_type="extend_prop_time",
        entity_type="prop_account", entity_id=str(prop.id),
        changes=[{"field": "expires_at", "old_value": None, "new_value": str(data.days)}],
    )
    await log.insert()
    return {"message": f"Extended by {data.days} day(s)", "expires_at": prop.expires_at.isoformat() if prop.expires_at else None}


@router.post("/accounts/{prop_id}/reset")
async def reset_account(prop_id: str, admin: User = Depends(get_admin_user)):
    try:
        prop = await prop_engine.reset_account(prop_id, admin.id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    log = AdminAuditLog(
        admin_id=admin.id, action_type="reset_prop",
        entity_type="prop_account", entity_id=str(prop.id),
        changes=[{"field": "status", "old_value": None, "new_value": "active"}],
    )
    await log.insert()
    return {"message": "Account reset", "account_id": str(prop.id)}


# --------------------------------------------------------------------------
# DASHBOARD
# --------------------------------------------------------------------------

@router.get("/dashboard")
async def admin_prop_dashboard(admin: User = Depends(get_admin_user)):
    settings = await prop_engine.get_or_create_prop_settings(admin.id)
    challenge_filter = PropChallenge.find(
        PropChallenge.admin_id == admin.id, PropChallenge.is_active == True,
    )
    total_challenges = await challenge_filter.count()
    total_accounts = await PropAccount.count()
    active = await PropAccount.find(PropAccount.status == PropAccountStatus.ACTIVE).count()
    passed = await PropAccount.find(PropAccount.status == PropAccountStatus.PASSED).count()
    failed = await PropAccount.find(PropAccount.status == PropAccountStatus.BLOWN).count()
    funded = await PropAccount.find(PropAccount.status == PropAccountStatus.FUNDED).count()

    return {
        "challenge_mode_enabled": settings.challenge_mode_enabled,
        "total_challenges": total_challenges,
        "total_accounts": total_accounts,
        "active_accounts": active,
        "passed_accounts": passed,
        "failed_accounts": failed,
        "funded_accounts": funded,
    }


# --------------------------------------------------------------------------
# PAYOUT QUEUE
# --------------------------------------------------------------------------

@router.get("/payouts")
async def list_payouts(
    status: str = Query("pending"),
    admin: User = Depends(get_admin_user),
):
    query = Transaction.find(Transaction.type == TransactionType.PROP_PAYOUT)
    if status and status != "all":
        query = query.find(Transaction.status == status)
    txs = await query.sort("-created_at").limit(200).to_list()

    enriched = []
    for tx in txs:
        u = await User.get(tx.user_id)
        prop = await PropAccount.get(tx.prop_account_id) if tx.prop_account_id else None
        enriched.append({
            "id": str(tx.id),
            "created_at": tx.created_at.isoformat(),
            "status": tx.status.value,
            "requested_amount": tx.amount,
            "user_note": tx.user_note or "",
            "user": {
                "id": str(u.id), "name": u.name, "email": u.email,
                "kyc_status": u.kyc_status.value if hasattr(u.kyc_status, "value") else u.kyc_status,
            } if u else None,
            "prop_account": {
                "id": str(prop.id),
                "status": prop.status.value,
                "current_balance": prop.sub_wallet_balance,
                "initial_balance": prop.account_size,
                "profit_split_pct": prop.profit_split_pct,
                "last_withdrawal_date": prop.last_withdrawal_date.isoformat() if prop.last_withdrawal_date else None,
            } if prop else None,
            "profit": (tx.payment_details or {}).get("profit"),
            "split_pct": (tx.payment_details or {}).get("split_pct"),
            "admin_notes": tx.admin_notes or "",
            "rejection_reason": tx.rejection_reason or "",
            "reviewed_at": tx.reviewed_at.isoformat() if tx.reviewed_at else None,
        })
    return {"payouts": enriched}


class ApprovePayoutRequest(BaseModel):
    custom_amount: Optional[float] = None
    override_cooldown: bool = False
    admin_note: str = ""


@router.post("/payouts/{txn_id}/approve")
async def approve_payout(txn_id: str, data: ApprovePayoutRequest, admin: User = Depends(get_admin_user)):
    try:
        result = await prop_engine.approve_payout(
            txn_id, admin.id,
            custom_amount=data.custom_amount,
            override_cooldown=data.override_cooldown,
            admin_note=data.admin_note,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    log = AdminAuditLog(
        admin_id=admin.id, action_type="approve_prop_payout",
        entity_type="transaction", entity_id=txn_id,
        changes=[{"field": "amount", "old_value": None, "new_value": result["amount"]}],
    )
    await log.insert()
    return {
        "message": f"Payout approved: {result['amount']:.2f} credited to wallet",
        "amount": result["amount"],
        "wallet_balance": result["wallet_balance"],
    }


class RejectPayoutRequest(BaseModel):
    reason: str = Field(..., min_length=1)


@router.post("/payouts/{txn_id}/reject")
async def reject_payout(txn_id: str, data: RejectPayoutRequest, admin: User = Depends(get_admin_user)):
    try:
        tx = await prop_engine.reject_payout(txn_id, admin.id, data.reason)
    except ValueError as e:
        raise HTTPException(400, str(e))
    log = AdminAuditLog(
        admin_id=admin.id, action_type="reject_prop_payout",
        entity_type="transaction", entity_id=txn_id,
        changes=[{"field": "rejection_reason", "old_value": None, "new_value": data.reason}],
    )
    await log.insert()
    return {"message": "Payout rejected"}
