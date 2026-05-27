"""
XMLiquidity — Banking Settings Router
Users save their withdrawal banking/crypto details.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.banking import BankingDetail, BankingType

router = APIRouter(prefix="/banking", tags=["Banking Settings"])


class AddBankingRequest(BaseModel):
    type: str = Field(..., pattern="^(crypto_btc|crypto_eth|crypto_usdt|bank_account)$")
    label: str = Field("", max_length=100)
    is_default: bool = False
    wallet_address: Optional[str] = None
    network: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    swift_code: Optional[str] = None
    iban: Optional[str] = None
    bank_address: Optional[str] = None


@router.get("/")
async def list_banking_details(user: User = Depends(get_current_user)):
    """List all saved banking/crypto details."""
    details = await BankingDetail.find(
        BankingDetail.user_id == user.id, BankingDetail.is_active == True
    ).sort("-is_default").to_list()

    return [
        {
            "id": str(d.id),
            "type": d.type.value,
            "label": d.label,
            "is_default": d.is_default,
            "wallet_address": d.wallet_address,
            "network": d.network,
            "bank_name": d.bank_name,
            "account_holder": d.account_holder,
            "account_number": d.account_number[-4:] if d.account_number else None,  # Mask
            "ifsc_code": d.ifsc_code,
            "swift_code": d.swift_code,
            "created_at": d.created_at.isoformat(),
        }
        for d in details
    ]


@router.post("/", status_code=201)
async def add_banking_detail(data: AddBankingRequest, user: User = Depends(get_current_user)):
    """Add a new banking/crypto withdrawal method."""
    # Validate based on type
    if data.type.startswith("crypto") and not data.wallet_address:
        raise HTTPException(status_code=400, detail="Wallet address is required for crypto")
    if data.type == "bank_account" and not data.account_number:
        raise HTTPException(status_code=400, detail="Account number is required for bank")

    # If setting as default, unset other defaults of same type
    if data.is_default:
        existing = await BankingDetail.find(
            BankingDetail.user_id == user.id,
            BankingDetail.type == BankingType(data.type),
            BankingDetail.is_default == True,
        ).to_list()
        for e in existing:
            e.is_default = False
            await e.save()

    detail = BankingDetail(
        user_id=user.id,
        type=BankingType(data.type),
        label=data.label or f"My {data.type.replace('_', ' ').title()}",
        is_default=data.is_default,
        wallet_address=data.wallet_address,
        network=data.network,
        bank_name=data.bank_name,
        account_holder=data.account_holder,
        account_number=data.account_number,
        ifsc_code=data.ifsc_code,
        swift_code=data.swift_code,
        iban=data.iban,
        bank_address=data.bank_address,
    )
    await detail.insert()

    return {"id": str(detail.id), "message": "Banking detail added"}


@router.delete("/{detail_id}")
async def remove_banking_detail(detail_id: str, user: User = Depends(get_current_user)):
    """Remove a saved banking detail."""
    detail = await BankingDetail.get(detail_id)
    if not detail or detail.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")

    detail.is_active = False
    await detail.save()
    return {"message": "Banking detail removed"}


@router.patch("/{detail_id}/set-default")
async def set_default(detail_id: str, user: User = Depends(get_current_user)):
    """Set a banking detail as the default for its type."""
    detail = await BankingDetail.get(detail_id)
    if not detail or detail.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")

    # Unset other defaults of same type
    others = await BankingDetail.find(
        BankingDetail.user_id == user.id,
        BankingDetail.type == detail.type,
        BankingDetail.is_default == True,
    ).to_list()
    for o in others:
        o.is_default = False
        await o.save()

    detail.is_default = True
    await detail.save()
    return {"message": "Set as default"}
