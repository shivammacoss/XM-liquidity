"""
XMLiquidity — IB Router
Create IB accounts, get dashboard, referral links, commission history.
"""

import secrets
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.ib import IBAccount, IBTree, IBCommission, IBType
from app.models.wallet import Wallet
from app.services.ib_engine import get_ib_dashboard

router = APIRouter(prefix="/ib", tags=["Business / IB"])


class CreateIBRequest(BaseModel):
    ib_type: str = Field(..., pattern="^(direct|community|sub_broker)$")
    referral_code_used: Optional[str] = None  # If signing up under another IB


@router.post("/create", status_code=201)
async def create_ib_account(data: CreateIBRequest, user: User = Depends(get_current_user)):
    """Create an IB account for the user."""
    existing = await IBAccount.find_one(IBAccount.user_id == user.id, IBAccount.is_active == True)
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active IB account")

    parent_ib_id = None
    level = 1

    # If referred by another IB
    if data.referral_code_used:
        parent = await IBAccount.find_one(IBAccount.referral_code == data.referral_code_used, IBAccount.is_active == True)
        if parent:
            parent_ib_id = parent.id
            parent_tree = await IBTree.find_one(IBTree.user_id == parent.user_id)
            level = (parent_tree.depth + 1) if parent_tree else 2

    ib = IBAccount(
        user_id=user.id,
        ib_type=IBType(data.ib_type),
        referral_code=f"ST-{secrets.token_hex(4).upper()}",
        parent_ib_id=parent_ib_id,
        level=level,
    )
    await ib.insert()

    # Create IB tree entry
    ancestors = []
    if parent_ib_id:
        parent_ib = await IBAccount.get(parent_ib_id)
        if parent_ib:
            parent_tree = await IBTree.find_one(IBTree.user_id == parent_ib.user_id)
            if parent_tree:
                ancestors = [parent_ib.user_id] + parent_tree.ancestors[:9]  # Max 10 levels
            else:
                ancestors = [parent_ib.user_id]

    tree = IBTree(user_id=user.id, ancestors=ancestors, depth=len(ancestors))
    await tree.insert()

    # Update parent stats
    if parent_ib_id:
        parent_ib_doc = await IBAccount.get(parent_ib_id)
        if parent_ib_doc:
            parent_ib_doc.total_referrals += 1
            parent_ib_doc.active_referrals += 1
            await parent_ib_doc.save()

    return {
        "id": str(ib.id),
        "ib_type": ib.ib_type.value,
        "referral_code": ib.referral_code,
        "level": ib.level,
        "message": "IB account created successfully",
    }


@router.get("/dashboard")
async def ib_dashboard(user: User = Depends(get_current_user)):
    """Get IB dashboard with earnings, referrals, level distribution."""
    return await get_ib_dashboard(user.id)


@router.get("/commissions")
async def get_commissions(
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get IB commission history with pagination."""
    ib = await IBAccount.find_one(IBAccount.user_id == user.id, IBAccount.is_active == True)
    if not ib:
        raise HTTPException(status_code=404, detail="No IB account found")

    total = await IBCommission.find(IBCommission.ib_id == ib.id).count()
    skip = (page - 1) * per_page
    commissions = await IBCommission.find(
        IBCommission.ib_id == ib.id
    ).sort("-created_at").skip(skip).limit(per_page).to_list()

    return {
        "commissions": [
            {
                "id": str(c.id),
                "amount": round(c.amount, 4),
                "level": c.level,
                "revenue_type": c.revenue_type,
                "source_user_id": str(c.source_user_id),
                "created_at": c.created_at.isoformat(),
            }
            for c in commissions
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/referral-link")
async def get_referral_link(user: User = Depends(get_current_user)):
    """Get the user's referral link."""
    ib = await IBAccount.find_one(IBAccount.user_id == user.id, IBAccount.is_active == True)
    if not ib:
        raise HTTPException(status_code=404, detail="No IB account found")

    return {
        "referral_code": ib.referral_code,
        "referral_link": f"https://xmliquidity.com/signup?ref={ib.referral_code}",
    }
