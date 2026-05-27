"""
XMLiquidity — Accounts Router
CRUD for trading accounts (6 types). Account opens empty, locked until funded.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.account import TradingAccount, AccountType, AccountStatus
from app.models.wallet import Wallet
from app.schemas.account import (
    CreateAccountRequest, AccountResponse, AccountListResponse,
)

router = APIRouter(prefix="/accounts", tags=["Trading Accounts"])


def _account_to_response(acct: TradingAccount) -> AccountResponse:
    return AccountResponse(
        id=str(acct.id),
        user_id=str(acct.user_id),
        account_type=acct.account_type.value,
        account_number=acct.account_number,
        balance=acct.balance,
        equity=acct.equity,
        margin_used=acct.margin_used,
        free_margin=acct.free_margin,
        leverage=acct.leverage,
        currency=acct.currency,
        is_funded=acct.is_funded,
        status=acct.status.value,
        is_prop_account=acct.is_prop_account,
        total_trades=acct.total_trades,
        total_pnl=round(acct.total_pnl, 2),
        win_count=acct.win_count,
        loss_count=acct.loss_count,
        win_rate=acct.win_rate,
        created_at=acct.created_at.isoformat(),
    )


@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: CreateAccountRequest,
    user: User = Depends(get_current_user),
):
    """
    Create a new trading account. Opens with $0 balance.
    Trading is locked until user deposits funds.
    """
    # Validate account type
    try:
        acct_type = AccountType(data.account_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid account type")

    # Check if user is KYC approved for certain account types
    # (Elite requires KYC)
    if acct_type == AccountType.ELITE and user.kyc_status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Elite account requires KYC verification",
        )

    # Create the account
    account = TradingAccount(
        user_id=user.id,
        account_type=acct_type,
        leverage=data.leverage,
        currency=data.currency,
    )

    # Ensure unique account number
    while await TradingAccount.find_one(TradingAccount.account_number == account.account_number):
        from app.models.account import generate_account_number
        account.account_number = generate_account_number()

    await account.insert()

    # Ensure user has a wallet (create if not exists)
    wallet = await Wallet.find_one(Wallet.user_id == user.id)
    if not wallet:
        wallet = Wallet(user_id=user.id)
        await wallet.insert()

    return _account_to_response(account)


@router.get("/", response_model=AccountListResponse)
async def list_accounts(
    user: User = Depends(get_current_user),
    account_type: str = Query(None, description="Filter by type"),
    status_filter: str = Query(None, alias="status", description="Filter by status"),
):
    """List all trading accounts for the authenticated user."""
    query = TradingAccount.find(TradingAccount.user_id == user.id)

    if account_type:
        query = query.find(TradingAccount.account_type == account_type)
    if status_filter:
        query = query.find(TradingAccount.status == status_filter)

    accounts = await query.sort("-created_at").to_list()

    return AccountListResponse(
        accounts=[_account_to_response(a) for a in accounts],
        total=len(accounts),
    )


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: str,
    user: User = Depends(get_current_user),
):
    """Get a specific trading account by ID."""
    account = await TradingAccount.get(account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found")

    return _account_to_response(account)


@router.patch("/{account_id}/leverage")
async def update_leverage(
    account_id: str,
    leverage: int = Query(..., ge=1, le=500),
    user: User = Depends(get_current_user),
):
    """Update leverage for a trading account. Cannot change while trades are open."""
    account = await TradingAccount.get(account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found")

    # Check no open trades
    from app.models.trade import Trade, TradeStatus
    open_trades = await Trade.find(
        Trade.account_id == account.id,
        Trade.status == TradeStatus.OPEN,
    ).count()

    if open_trades > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot change leverage while trades are open",
        )

    account.leverage = leverage
    account.updated_at = datetime.now(timezone.utc)
    await account.save()

    return _account_to_response(account)


@router.delete("/{account_id}")
async def delete_account(
    account_id: str,
    user: User = Depends(get_current_user),
):
    """Delete/close a trading account. Must have no open trades and zero balance."""
    account = await TradingAccount.get(account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.is_prop_account:
        raise HTTPException(status_code=400, detail="Cannot delete prop challenge accounts")

    from app.models.trade import Trade, TradeStatus
    open_trades = await Trade.find(
        Trade.account_id == account.id,
        Trade.status == TradeStatus.OPEN,
    ).count()

    if open_trades > 0:
        raise HTTPException(status_code=400, detail="Close all open trades before deleting account")

    if account.balance > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Transfer ${account.balance:.2f} to wallet before deleting account",
        )

    account.status = AccountStatus.CLOSED
    account.is_active = False
    account.updated_at = datetime.now(timezone.utc)
    await account.save()

    return {"message": f"Account {account.account_number} closed"}
