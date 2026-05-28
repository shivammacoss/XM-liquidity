"""
XMLiquidity — Admin Dashboard + User Management + Trade Management + Risk + Charges + Settings
All admin endpoints behind role verification.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List

from app.middleware.auth import get_current_user, get_admin_user, get_super_admin
from app.models.user import User, UserRole
from app.models.account import TradingAccount
from app.models.trade import Trade, TradeStatus, TradeDirection
from app.models.wallet import Wallet
from app.models.transaction import Transaction, TransactionStatus
from app.models.prop import PropAccount, PropAccountStatus
from app.models.ib import IBAccount
from app.models.challenge import Challenge
from app.models.instrument import Instrument, Segment
from app.models.charge import ChargeSettings, ChargeLevel
from app.models.kyc import KYCDocument, KYCStatus
from app.models.admin import AdminAuditLog, AccountTypeSettings, SubAdminPermissions
from app.models.copy_trading import CopyMaster, MasterStatus, PAMMAccount, PAMMStatus

router = APIRouter(prefix="/admin", tags=["Admin Panel"])


# ==========================================
# SIGNUP REQUEST MANAGEMENT
# ==========================================

from app.models.signup_request import SignupRequest, SignupRequestStatus


@router.get("/signup-requests", dependencies=[Depends(get_admin_user)])
async def list_signup_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = SignupRequest.find()
    if status_filter:
        query = query.find(SignupRequest.status == status_filter)

    total = await query.count()
    skip = (page - 1) * per_page
    requests = await query.sort("-created_at").skip(skip).limit(per_page).to_list()

    return {
        "requests": [
            {
                "id": str(r.id),
                "name": r.name,
                "email": r.email,
                "phone": r.phone,
                "message": r.message,
                "status": r.status.value,
                "created_at": r.created_at.isoformat(),
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "rejection_reason": r.rejection_reason,
            }
            for r in requests
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


class RejectSignupRequest(BaseModel):
    reason: str = ""


@router.post("/signup-requests/{req_id}/reject")
async def reject_signup_request(
    req_id: str,
    data: RejectSignupRequest,
    admin: User = Depends(get_admin_user),
):
    req = await SignupRequest.get(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Signup request not found")
    if req.status != SignupRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request already processed")

    req.status = SignupRequestStatus.REJECTED
    req.rejection_reason = data.reason
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    await req.save()

    log = AdminAuditLog(
        admin_id=admin.id,
        action_type="reject_signup_request",
        entity_type="signup_request",
        entity_id=req_id,
        changes=[{"field": "status", "old_value": "pending", "new_value": "rejected"}],
    )
    await log.insert()

    return {"message": f"Signup request from {req.email} rejected"}


async def _provision_user_account(user: User):
    """Create wallet + liquidity trading account for a new user."""
    from app.models.wallet import Wallet
    from app.models.account import TradingAccount, AccountType, generate_account_number

    wallet = await Wallet.find_one(Wallet.user_id == user.id)
    if not wallet:
        wallet = Wallet(user_id=user.id)
        await wallet.insert()

    existing_acct = await TradingAccount.find_one(
        TradingAccount.user_id == user.id,
        TradingAccount.is_prop_account == False,
    )
    if not existing_acct:
        acct_number = generate_account_number()
        while await TradingAccount.find_one(TradingAccount.account_number == acct_number):
            acct_number = generate_account_number()
        account = TradingAccount(
            user_id=user.id,
            account_type=AccountType.ECN,
            account_number=acct_number,
        )
        await account.insert()


class CreateUserDirectRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str
    phone: Optional[str] = None
    password: str = Field(..., min_length=6, max_length=128)


@router.post("/create-user", status_code=201)
async def admin_create_user(
    data: CreateUserDirectRequest,
    admin: User = Depends(get_admin_user),
):
    existing = await User.find_one(User.email == data.email.lower())
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    from app.utils.security import hash_password
    user = User(
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        name=data.name.strip(),
        phone=data.phone,
    )
    await user.insert()

    await _provision_user_account(user)

    log = AdminAuditLog(
        admin_id=admin.id,
        action_type="create_user",
        entity_type="user",
        entity_id=str(user.id),
        changes=[{"field": "email", "old_value": None, "new_value": data.email}],
    )
    await log.insert()

    return {
        "message": f"Account created for {data.email}",
        "user_id": str(user.id),
        "email": data.email,
        "password": data.password,
    }


class ApproveSignupRequest(BaseModel):
    password: str = Field(..., min_length=6, max_length=128)


@router.post("/signup-requests/{req_id}/approve")
async def approve_signup_request(
    req_id: str,
    data: ApproveSignupRequest,
    admin: User = Depends(get_admin_user),
):
    req = await SignupRequest.get(req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Signup request not found")
    if req.status != SignupRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request already processed")

    existing_user = await User.find_one(User.email == req.email.lower())
    if existing_user:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    from app.utils.security import hash_password
    user = User(
        email=req.email.lower().strip(),
        password_hash=hash_password(data.password),
        name=req.name.strip(),
        phone=req.phone,
    )
    await user.insert()

    await _provision_user_account(user)

    req.status = SignupRequestStatus.APPROVED
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.created_user_id = user.id
    await req.save()

    log = AdminAuditLog(
        admin_id=admin.id,
        action_type="approve_signup_request",
        entity_type="signup_request",
        entity_id=req_id,
        changes=[
            {"field": "status", "old_value": "pending", "new_value": "approved"},
            {"field": "created_user_id", "old_value": None, "new_value": str(user.id)},
        ],
    )
    await log.insert()

    return {
        "message": f"Account created for {req.email}",
        "user_id": str(user.id),
        "email": req.email,
        "password": data.password,
    }


# ==========================================
# DASHBOARD STATS
# ==========================================

@router.get("/dashboard", dependencies=[Depends(get_admin_user)])
async def admin_dashboard(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Admin dashboard with all platform stats. Filterable by date range."""
    total_users = await User.find(User.role == UserRole.USER).count()
    active_users = await User.find(User.role == UserRole.USER, User.is_active == True).count()
    blocked_users = await User.find(User.is_blocked == True).count()

    total_accounts = await TradingAccount.count()
    total_deposits = await Transaction.find(Transaction.type == "deposit", Transaction.status == "completed").count()
    total_withdrawals = await Transaction.find(Transaction.type == "withdrawal", Transaction.status == "completed").count()

    # Prop stats
    prop_active = await PropAccount.find(PropAccount.status == PropAccountStatus.ACTIVE).count()
    prop_passed = await PropAccount.find(PropAccount.status == PropAccountStatus.FUNDED).count()
    prop_blown = await PropAccount.find(PropAccount.status == PropAccountStatus.BLOWN).count()

    # IB stats
    total_ibs = await IBAccount.find(IBAccount.is_active == True).count()

    # Challenge stats
    active_challenges = await Challenge.find(Challenge.status == "active").count()

    # Financial totals
    all_wallets = await Wallet.find().to_list()
    total_wallet_balance = sum(w.balance for w in all_wallets)
    total_deposited = sum(w.total_deposited for w in all_wallets)
    total_withdrawn = sum(w.total_withdrawn for w in all_wallets)

    # Trade stats
    open_trades = await Trade.find(Trade.status == TradeStatus.OPEN).count()
    closed_trades = await Trade.find(Trade.status == TradeStatus.CLOSED).count()

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "blocked": blocked_users,
        },
        "accounts": {"total": total_accounts},
        "finances": {
            "total_wallet_balance": round(total_wallet_balance, 2),
            "total_deposited": round(total_deposited, 2),
            "total_withdrawn": round(total_withdrawn, 2),
        },
        "trades": {
            "open": open_trades,
            "closed": closed_trades,
        },
        "prop": {
            "active": prop_active,
            "passed": prop_passed,
            "blown": prop_blown,
        },
        "business": {"total_ibs": total_ibs},
        "challenges": {"active": active_challenges},
    }


# ==========================================
# USER MANAGEMENT
# ==========================================

@router.get("/users", dependencies=[Depends(get_admin_user)])
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
):
    """List all users with pagination and filters."""
    query = User.find()
    if role:
        query = query.find(User.role == role)
    if status == "blocked":
        query = query.find(User.is_blocked == True)
    elif status == "active":
        query = query.find(User.is_active == True, User.is_blocked == False)

    total = await query.count()
    skip = (page - 1) * per_page
    users = await query.sort("-created_at").skip(skip).limit(per_page).to_list()

    # Apply search filter
    if search:
        s = search.lower()
        users = [u for u in users if s in u.email.lower() or s in u.name.lower()]

    from app.services.auth_service import user_to_public
    return {
        "users": [user_to_public(u).model_dump() for u in users],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/users/{user_id}", dependencies=[Depends(get_admin_user)])
async def get_user_detail(user_id: str):
    """Get full user details including accounts, trades, sessions."""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    accounts = await TradingAccount.find(TradingAccount.user_id == user.id).to_list()
    wallet = await Wallet.find_one(Wallet.user_id == user.id)
    open_trades = await Trade.find(Trade.user_id == user.id, Trade.status == TradeStatus.OPEN).count()
    total_trades = await Trade.find(Trade.user_id == user.id).count()
    total_pnl = sum(a.total_pnl for a in accounts)

    from app.models.session import Session
    sessions = await Session.find(Session.user_id == user.id).sort("-created_at").limit(10).to_list()

    kyc_docs = await KYCDocument.find(KYCDocument.user_id == user.id).to_list()

    from app.services.auth_service import user_to_public
    return {
        "user": user_to_public(user).model_dump(),
        "wallet_balance": wallet.balance if wallet else 0,
        "accounts_count": len(accounts),
        "accounts": [
            {
                "id": str(a.id),
                "type": a.account_type.value,
                "number": a.account_number,
                "balance": a.balance,
                "equity": a.equity,
                "total_pnl": round(a.total_pnl, 2),
            }
            for a in accounts
        ],
        "open_trades": open_trades,
        "total_trades": total_trades,
        "total_pnl": round(total_pnl, 2),
        "kyc_documents": [
            {"type": d.doc_type.value, "status": d.status.value}
            for d in kyc_docs
        ],
        "recent_sessions": [
            {
                "device": s.device_info[:50],
                "ip": s.ip_address,
                "active": s.is_active,
                "created_at": s.created_at.isoformat(),
            }
            for s in sessions
        ],
    }


class AdminUserAction(BaseModel):
    action: str = Field(..., pattern="^(block|unblock|restrict_trading|unrestrict_trading|approve_kyc|reject_kyc)$")
    reason: Optional[str] = None


@router.post("/users/{user_id}/action")
async def admin_user_action(
    user_id: str,
    data: AdminUserAction,
    admin: User = Depends(get_admin_user),
):
    """Admin actions on users: block, unblock, restrict trading, KYC approve/reject."""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.action == "block":
        user.is_blocked = True
        user.block_reason = data.reason or "Blocked by admin"
    elif data.action == "unblock":
        user.is_blocked = False
        user.block_reason = None
    elif data.action == "restrict_trading":
        user.is_trading_restricted = True
    elif data.action == "unrestrict_trading":
        user.is_trading_restricted = False
    elif data.action == "approve_kyc":
        user.kyc_status = "approved"
        await KYCDocument.find(KYCDocument.user_id == user.id).update({"$set": {"status": "approved"}})
        from app.services.notification_service import notify_kyc_approved
        await notify_kyc_approved(user.id)
    elif data.action == "reject_kyc":
        user.kyc_status = "rejected"
        await KYCDocument.find(KYCDocument.user_id == user.id).update(
            {"$set": {"status": "rejected", "rejection_reason": data.reason or "Rejected by admin"}}
        )
        from app.services.notification_service import notify_kyc_rejected
        await notify_kyc_rejected(user.id, data.reason or "")

    user.updated_at = datetime.now(timezone.utc)
    await user.save()

    # Audit log
    log = AdminAuditLog(
        admin_id=admin.id,
        action_type=data.action,
        entity_type="user",
        entity_id=user_id,
        changes=[{"field": data.action, "old_value": None, "new_value": data.reason}],
    )
    await log.insert()

    return {"message": f"Action '{data.action}' applied to user {user.email}"}


# ==========================================
# TRADE MANAGEMENT
# ==========================================

@router.get("/trades", dependencies=[Depends(get_admin_user)])
async def admin_list_trades(
    status_filter: Optional[str] = Query(None, alias="status"),
    user_id: Optional[str] = None,
    account_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    """List all trades across the platform with filters."""
    query = Trade.find()
    if status_filter:
        query = query.find(Trade.status == status_filter)
    if user_id:
        query = query.find(Trade.user_id == user_id)
    if account_id:
        query = query.find(Trade.account_id == account_id)

    total = await query.count()
    skip = (page - 1) * per_page
    trades = await query.sort("-open_time").skip(skip).limit(per_page).to_list()

    return {
        "trades": [
            {
                "id": str(t.id),
                "user_id": str(t.user_id),
                "account_id": str(t.account_id),
                "instrument": t.instrument,
                "direction": t.direction.value,
                "lot_size": t.lot_size,
                "open_price": t.open_price,
                "close_price": t.close_price,
                "current_price": t.current_price,
                "pnl": round(t.pnl, 2),
                "status": t.status.value,
                "spread_charged": round(t.spread_charged, 2),
                "swap_charged": round(t.swap_charged, 2),
                "commission_charged": round(t.commission_charged, 2),
                "open_time": t.open_time.isoformat(),
                "close_time": t.close_time.isoformat() if t.close_time else None,
                "is_admin_modified": t.is_admin_modified,
            }
            for t in trades
        ],
        "total": total,
        "page": page,
    }


class AdminModifyTradeRequest(BaseModel):
    open_price: Optional[float] = None
    close_price: Optional[float] = None
    spread_charged: Optional[float] = None
    swap_charged: Optional[float] = None
    commission_charged: Optional[float] = None
    pnl: Optional[float] = None


@router.patch("/trades/{trade_id}")
async def admin_modify_trade(
    trade_id: str,
    data: AdminModifyTradeRequest,
    admin: User = Depends(get_admin_user),
):
    """Admin can modify any trade (open or historical). All changes are logged."""
    trade = await Trade.get(trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    changes = []
    for field in ["open_price", "close_price", "spread_charged", "swap_charged", "commission_charged", "pnl"]:
        new_val = getattr(data, field)
        if new_val is not None:
            old_val = getattr(trade, field)
            setattr(trade, field, new_val)
            changes.append({"field": field, "old_value": old_val, "new_value": new_val})

    if changes:
        trade.is_admin_modified = True
        trade.admin_modify_log.append({
            "admin_id": str(admin.id),
            "changes": changes,
            "modified_at": datetime.now(timezone.utc).isoformat(),
        })
        await trade.save()

        log = AdminAuditLog(
            admin_id=admin.id,
            action_type="modify_trade",
            entity_type="trade",
            entity_id=trade_id,
            changes=changes,
        )
        await log.insert()

    return {"message": f"Trade modified. {len(changes)} field(s) changed.", "changes": changes}


@router.post("/trades/{trade_id}/close")
async def admin_close_trade(
    trade_id: str,
    close_price: float = Query(...),
    admin: User = Depends(get_admin_user),
):
    """Admin force-close a trade at any price."""
    trade = await Trade.get(trade_id)
    if not trade or trade.status != TradeStatus.OPEN:
        raise HTTPException(status_code=400, detail="Trade not found or not open")

    from app.services.trade_engine import close_trade
    trade = await close_trade(trade, close_price)

    log = AdminAuditLog(
        admin_id=admin.id,
        action_type="force_close_trade",
        entity_type="trade",
        entity_id=trade_id,
        changes=[{"field": "close_price", "old_value": None, "new_value": close_price}],
    )
    await log.insert()

    return {"message": f"Trade closed at {close_price}", "pnl": round(trade.pnl, 2)}


# ==========================================
# DEPOSIT/WITHDRAWAL MANAGEMENT
# ==========================================

@router.get("/transactions", dependencies=[Depends(get_admin_user)])
async def admin_list_transactions(
    status_filter: Optional[str] = Query(None, alias="status"),
    type_filter: Optional[str] = Query(None, alias="type"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    """List all transactions for admin review."""
    query = Transaction.find()
    if status_filter:
        query = query.find(Transaction.status == status_filter)
    if type_filter:
        query = query.find(Transaction.type == type_filter)

    total = await query.count()
    skip = (page - 1) * per_page
    txns = await query.sort("-created_at").skip(skip).limit(per_page).to_list()

    return {
        "transactions": [
            {
                "id": str(t.id),
                "user_id": str(t.user_id),
                "type": t.type.value,
                "method": t.method.value,
                "status": t.status.value,
                "amount": t.amount,
                "crypto_txn_hash": t.crypto_txn_hash,
                "memo_tag": t.memo_tag,
                "from_address": t.from_address,
                "payment_details": t.payment_details or {},
                "admin_notes": t.admin_notes,
                "rejection_reason": t.rejection_reason,
                "created_at": t.created_at.isoformat(),
            }
            for t in txns
        ],
        "total": total,
        "page": page,
    }


class ApproveTransactionRequest(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    admin_notes: Optional[str] = None


@router.post("/transactions/{txn_id}/review")
async def admin_review_transaction(
    txn_id: str,
    data: ApproveTransactionRequest,
    admin: User = Depends(get_admin_user),
):
    """Admin approves or rejects a deposit/withdrawal."""
    txn = await Transaction.get(txn_id)
    if not txn or txn.status != TransactionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Transaction not found or not pending")

    wallet = await Wallet.find_one(Wallet.user_id == txn.user_id)

    # Fixed locked-capital floor: the first $5,000 of every deposit is
    # automatically routed into the broker's trading account so it counts
    # toward their protected minimum. Anything above $5k flows into the
    # wallet as spendable balance.
    LOCKED_CAPITAL_FIXED = 5000.0

    if data.action == "approve":
        txn.status = TransactionStatus.COMPLETED
        if txn.type.value == "deposit" and wallet:
            from app.models.account import TradingAccount
            # Match the order the broker's Accounts page uses
            # (accounts/list sorts by -created_at, so accounts[0] = newest).
            accounts_list = await TradingAccount.find(
                TradingAccount.user_id == txn.user_id,
                TradingAccount.is_prop_account == False,
            ).sort("-created_at").to_list()
            main_account = accounts_list[0] if accounts_list else None

            deposit_amt = float(txn.amount)
            to_account = 0.0
            to_wallet = deposit_amt

            if main_account:
                current_locked = float(main_account.balance or 0.0)
                lock_needed = max(0.0, LOCKED_CAPITAL_FIXED - current_locked)
                to_account = min(deposit_amt, lock_needed)
                to_wallet = deposit_amt - to_account

                if to_account > 0:
                    main_account.balance += to_account
                    main_account.equity += to_account
                    main_account.free_margin += to_account
                    if not main_account.is_funded:
                        main_account.is_funded = True
                    # initial_deposit tracks the locked baseline (capped at $5k)
                    main_account.initial_deposit = min(
                        LOCKED_CAPITAL_FIXED,
                        max(float(main_account.initial_deposit or 0.0), main_account.balance),
                    )
                    main_account.updated_at = datetime.now(timezone.utc)
                    await main_account.save()

            if to_wallet > 0:
                wallet.balance += to_wallet
            wallet.total_deposited += deposit_amt
            wallet.updated_at = datetime.now(timezone.utc)
            await wallet.save()
        elif txn.type.value == "withdrawal":
            # Balance already deducted on request. Just mark complete.
            if wallet:
                wallet.total_withdrawn += txn.amount
                wallet.updated_at = datetime.now(timezone.utc)
                await wallet.save()
    elif data.action == "reject":
        txn.status = TransactionStatus.REJECTED
        # Refund if it was a withdrawal (balance was already deducted)
        if txn.type.value == "withdrawal" and wallet:
            wallet.balance += txn.amount
            wallet.updated_at = datetime.now(timezone.utc)
            await wallet.save()

    txn.admin_notes = data.admin_notes
    txn.reviewed_by = admin.id
    txn.reviewed_at = datetime.now(timezone.utc)
    await txn.save()

    log = AdminAuditLog(
        admin_id=admin.id,
        action_type=f"{data.action}_transaction",
        entity_type="transaction",
        entity_id=txn_id,
        changes=[{"field": "status", "old_value": "pending", "new_value": data.action}],
    )
    await log.insert()

    # Send notification to user
    from app.services.notification_service import (
        notify_deposit_approved, notify_deposit_rejected,
        notify_withdrawal_approved, notify_withdrawal_rejected,
    )
    if data.action == "approve":
        if txn.type.value == "deposit":
            await notify_deposit_approved(txn.user_id, txn.amount)
        elif txn.type.value == "withdrawal":
            await notify_withdrawal_approved(txn.user_id, txn.amount)
    elif data.action == "reject":
        reason = data.admin_notes or ""
        if txn.type.value == "deposit":
            await notify_deposit_rejected(txn.user_id, txn.amount, reason)
        elif txn.type.value == "withdrawal":
            await notify_withdrawal_rejected(txn.user_id, txn.amount, reason)

    return {"message": f"Transaction {data.action}d", "new_status": txn.status.value}


# ==========================================
# CHARGE MANAGEMENT
# ==========================================

class SetChargeRequest(BaseModel):
    level: str = Field(..., pattern="^(default|account_type|user)$")
    target_id: Optional[str] = None
    instrument_id: Optional[str] = None
    segment: Optional[str] = None
    spread_markup: float = 0.0
    swap_long: float = 0.0
    swap_short: float = 0.0
    commission_per_lot: float = 0.0


@router.post("/charges")
async def set_charge(data: SetChargeRequest, admin: User = Depends(get_super_admin)):
    """Set charge settings at any level. Super admin only."""
    # Check for existing setting
    query_filters = {"level": data.level}
    if data.target_id:
        query_filters["target_id"] = data.target_id
    if data.instrument_id:
        query_filters["instrument_id"] = data.instrument_id

    existing = await ChargeSettings.find_one(query_filters)

    priority_map = {"default": 0, "account_type": 10, "user": 20}

    if existing:
        existing.spread_markup = data.spread_markup
        existing.swap_long = data.swap_long
        existing.swap_short = data.swap_short
        existing.commission_per_lot = data.commission_per_lot
        existing.segment = data.segment
        existing.updated_at = datetime.now(timezone.utc)
        await existing.save()
        return {"message": "Charge updated", "id": str(existing.id)}
    else:
        charge = ChargeSettings(
            level=ChargeLevel(data.level),
            target_id=data.target_id,
            instrument_id=data.instrument_id,
            segment=data.segment,
            spread_markup=data.spread_markup,
            swap_long=data.swap_long,
            swap_short=data.swap_short,
            commission_per_lot=data.commission_per_lot,
            priority=priority_map.get(data.level, 0),
        )
        await charge.insert()
        return {"message": "Charge created", "id": str(charge.id)}


@router.get("/charges", dependencies=[Depends(get_admin_user)])
async def list_charges():
    """List all charge settings."""
    charges = await ChargeSettings.find(ChargeSettings.is_active == True).sort("priority").to_list()
    return [
        {
            "id": str(c.id),
            "level": c.level.value,
            "target_id": c.target_id,
            "instrument_id": c.instrument_id,
            "segment": c.segment,
            "spread_markup": c.spread_markup,
            "swap_long": c.swap_long,
            "swap_short": c.swap_short,
            "commission_per_lot": c.commission_per_lot,
            "priority": c.priority,
        }
        for c in charges
    ]


# ==========================================
# INSTRUMENT MANAGEMENT
# ==========================================

class CreateInstrumentRequest(BaseModel):
    symbol: str
    display_name: str
    segment: str
    pip_size: float = 0.0001
    lot_size: float = 100000
    min_lot: float = 0.01
    max_lot: float = 100.0
    trading_hours: str = "24/5"
    infoway_symbol: Optional[str] = None


@router.post("/instruments", status_code=201)
async def create_instrument(data: CreateInstrumentRequest, admin: User = Depends(get_super_admin)):
    """Add a new tradeable instrument."""
    existing = await Instrument.find_one(Instrument.symbol == data.symbol.upper())
    if existing:
        raise HTTPException(status_code=400, detail="Instrument already exists")

    inst = Instrument(
        symbol=data.symbol.upper(),
        display_name=data.display_name,
        segment=Segment(data.segment),
        pip_size=data.pip_size,
        lot_size=data.lot_size,
        min_lot=data.min_lot,
        max_lot=data.max_lot,
        trading_hours=data.trading_hours,
        infoway_symbol=data.infoway_symbol,
    )
    await inst.insert()
    return {"message": f"Instrument {data.symbol} created", "id": str(inst.id)}


@router.patch("/instruments/{symbol}/toggle")
async def toggle_instrument(symbol: str, admin: User = Depends(get_super_admin)):
    """Hide/show an instrument."""
    inst = await Instrument.find_one(Instrument.symbol == symbol.upper())
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")

    inst.is_hidden = not inst.is_hidden
    await inst.save()
    return {"symbol": inst.symbol, "is_hidden": inst.is_hidden}


# ==========================================
# COPY TRADING / PAMM ADMIN
# ==========================================

@router.get("/copy-masters", dependencies=[Depends(get_admin_user)])
async def admin_list_masters(status_filter: Optional[str] = Query(None, alias="status")):
    """List all copy trading master applications."""
    query = CopyMaster.find()
    if status_filter:
        query = query.find(CopyMaster.status == status_filter)
    masters = await query.sort("-created_at").to_list()

    result = []
    for m in masters:
        u = await User.get(m.user_id)
        result.append({
            "id": str(m.id),
            "user_name": u.name if u else "Unknown",
            "user_email": u.email if u else "",
            "status": m.status.value,
            "subscriber_count": m.subscriber_count,
            "total_pnl": round(m.total_pnl, 2),
            "charge_per_trade": m.charge_per_trade,
            "created_at": m.created_at.isoformat(),
        })
    return result


@router.post("/copy-masters/{master_id}/review")
async def admin_review_master(
    master_id: str,
    action: str = Query(..., pattern="^(approve|reject|block)$"),
    admin: User = Depends(get_admin_user),
):
    """Approve, reject, or block a copy trading master."""
    master = await CopyMaster.get(master_id)
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    master.status = MasterStatus(action + "d" if action != "block" else "blocked")
    if action == "approve":
        master.status = MasterStatus.APPROVED
        master.approved_by = admin.id
        master.approved_at = datetime.now(timezone.utc)
    elif action == "reject":
        master.status = MasterStatus.REJECTED
    elif action == "block":
        master.status = MasterStatus.BLOCKED

    await master.save()
    return {"message": f"Master {action}d"}


@router.post("/pamm/{pamm_id}/set-profit-share")
async def admin_set_pamm_profit_share(
    pamm_id: str,
    profit_share_pct: float = Query(..., ge=0, le=100),
    admin: User = Depends(get_super_admin),
):
    """Set PAMM profit sharing percentage (admin only)."""
    pamm = await PAMMAccount.get(pamm_id)
    if not pamm:
        raise HTTPException(status_code=404, detail="PAMM account not found")

    pamm.profit_share_pct = profit_share_pct
    await pamm.save()
    return {"message": f"PAMM profit share set to {profit_share_pct}%"}


# ==========================================
# PROP SETTINGS (ADMIN)
# ==========================================

class CreatePropSettingsRequest(BaseModel):
    prop_type: str = Field(..., pattern="^(one_step|two_step|instant_fund)$")
    account_size: float = Field(..., gt=0)
    price: float = Field(..., gt=0)
    phases_count: int = Field(1, ge=1, le=2)
    max_daily_loss_pct: float = 5.0
    max_total_loss_pct: float = 10.0
    profit_target_pct: float = 8.0
    min_trading_days: int = 5
    sl_required: bool = True
    max_lot_size: float = 10.0
    max_leverage: int = 100


@router.post("/prop-settings", status_code=201)
async def create_prop_settings(data: CreatePropSettingsRequest, admin: User = Depends(get_super_admin)):
    """Create a new prop challenge offering."""
    from app.models.prop import PropSettings, PropType
    settings = PropSettings(
        prop_type=PropType(data.prop_type),
        account_size=data.account_size,
        price=data.price,
        phases_count=data.phases_count,
        max_daily_loss_pct=data.max_daily_loss_pct,
        max_total_loss_pct=data.max_total_loss_pct,
        profit_target_pct=data.profit_target_pct,
        min_trading_days=data.min_trading_days,
        sl_required=data.sl_required,
        max_lot_size=data.max_lot_size,
        max_leverage=data.max_leverage,
    )
    await settings.insert()
    return {"message": "Prop settings created", "id": str(settings.id)}


# ==========================================
# CHALLENGE MANAGEMENT (ADMIN)
# ==========================================

class CreateChallengeRequest(BaseModel):
    title: str
    description: str = ""
    type: str = Field(..., pattern="^(daily|weekly|monthly)$")
    category: str = Field("best_performer", pattern="^(best_performer|best_lot_handler|best_holder|best_positive)$")
    start_at: str
    end_at: str
    entry_fee: float = 0.0
    rewards: dict = {}


@router.post("/challenges", status_code=201)
async def create_challenge(data: CreateChallengeRequest, admin: User = Depends(get_admin_user)):
    """Create a new challenge/competition."""
    from app.models.challenge import ChallengeType, ChallengeCategory
    challenge = Challenge(
        title=data.title,
        description=data.description,
        type=ChallengeType(data.type),
        category=ChallengeCategory(data.category),
        start_at=datetime.fromisoformat(data.start_at),
        end_at=datetime.fromisoformat(data.end_at),
        entry_fee=data.entry_fee,
        rewards=data.rewards,
        created_by=admin.id,
    )
    await challenge.insert()
    return {"message": "Challenge created", "id": str(challenge.id)}


# ==========================================
# IB SETTINGS (ADMIN)
# ==========================================

class SetIBLevelSettingsRequest(BaseModel):
    level_1_pct: float = Field(30.0, ge=0, le=100)
    decay_factor: float = Field(0.5, ge=0.1, le=1.0)
    level_overrides: dict = {}


@router.post("/ib-settings")
async def set_ib_level_settings(data: SetIBLevelSettingsRequest, admin: User = Depends(get_super_admin)):
    """Set IB community 10-level distribution settings."""
    from app.models.ib import IBLevelSettings
    existing = await IBLevelSettings.find_one(IBLevelSettings.is_active == True)
    if existing:
        existing.level_1_pct = data.level_1_pct
        existing.decay_factor = data.decay_factor
        existing.level_overrides = data.level_overrides
        await existing.save()
        return {"message": "IB settings updated"}
    else:
        settings = IBLevelSettings(
            level_1_pct=data.level_1_pct,
            decay_factor=data.decay_factor,
            level_overrides=data.level_overrides,
        )
        await settings.insert()
        return {"message": "IB settings created"}


# ==========================================
# RISK MANAGEMENT
# ==========================================

@router.get("/risk/net-positions", dependencies=[Depends(get_admin_user)])
async def get_net_positions():
    """Get net buy/sell positions across all instruments."""
    open_trades = await Trade.find(Trade.status == TradeStatus.OPEN).to_list()

    positions = {}
    for t in open_trades:
        if t.instrument not in positions:
            positions[t.instrument] = {"buy_lots": 0, "sell_lots": 0, "buy_count": 0, "sell_count": 0, "net_pnl": 0}

        if t.direction == TradeDirection.BUY:
            positions[t.instrument]["buy_lots"] += t.lot_size
            positions[t.instrument]["buy_count"] += 1
        else:
            positions[t.instrument]["sell_lots"] += t.lot_size
            positions[t.instrument]["sell_count"] += 1

        positions[t.instrument]["net_pnl"] += t.unrealized_pnl

    return [
        {
            "instrument": inst,
            "buy_lots": round(data["buy_lots"], 2),
            "sell_lots": round(data["sell_lots"], 2),
            "net_lots": round(data["buy_lots"] - data["sell_lots"], 2),
            "buy_count": data["buy_count"],
            "sell_count": data["sell_count"],
            "net_pnl": round(data["net_pnl"], 2),
        }
        for inst, data in sorted(positions.items())
    ]


# ==========================================
# AUDIT LOG
# ==========================================

@router.get("/audit-log", dependencies=[Depends(get_super_admin)])
async def get_audit_log(page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200)):
    """View admin audit log. Super admin only."""
    total = await AdminAuditLog.count()
    skip = (page - 1) * per_page
    logs = await AdminAuditLog.find().sort("-timestamp").skip(skip).limit(per_page).to_list()

    return {
        "logs": [
            {
                "id": str(l.id),
                "admin_id": str(l.admin_id),
                "action_type": l.action_type,
                "entity_type": l.entity_type,
                "entity_id": l.entity_id,
                "changes": l.changes,
                "timestamp": l.timestamp.isoformat(),
            }
            for l in logs
        ],
        "total": total,
        "page": page,
    }


# ==========================================
# PLATFORM PAYMENT SETTINGS
# Where brokers send deposits — admin sets, users view.
# ==========================================

from app.models.platform_settings import PlatformPaymentSettings, get_or_create_settings


class PaymentSettingsRequest(BaseModel):
    trc20_address: str = ""
    trc20_label: Optional[str] = None
    trc20_network_note: Optional[str] = None
    trc20_qr_url: Optional[str] = None    # "" clears the custom QR; None keeps existing
    bep20_address: str = ""
    bep20_label: Optional[str] = None
    bep20_network_note: Optional[str] = None
    bep20_qr_url: Optional[str] = None


def _settings_to_response(s: PlatformPaymentSettings) -> dict:
    return {
        "id": str(s.id),
        "trc20_address": s.trc20_address,
        "trc20_label": s.trc20_label,
        "trc20_network_note": s.trc20_network_note,
        "trc20_qr_url": s.trc20_qr_url,
        "bep20_address": s.bep20_address,
        "bep20_label": s.bep20_label,
        "bep20_network_note": s.bep20_network_note,
        "bep20_qr_url": s.bep20_qr_url,
        "updated_at": s.updated_at.isoformat(),
    }


@router.get("/payment-settings", dependencies=[Depends(get_admin_user)])
async def admin_get_payment_settings():
    """Read the platform deposit addresses (TRC20 + BEP20)."""
    s = await get_or_create_settings()
    return _settings_to_response(s)


@router.put("/payment-settings")
async def admin_update_payment_settings(
    data: PaymentSettingsRequest,
    admin: User = Depends(get_super_admin),
):
    """Replace the platform deposit addresses. Super admin only."""
    s = await get_or_create_settings()
    old_trc20 = s.trc20_address
    old_bep20 = s.bep20_address
    s.trc20_address = data.trc20_address
    s.bep20_address = data.bep20_address
    if data.trc20_label is not None:
        s.trc20_label = data.trc20_label
    if data.trc20_network_note is not None:
        s.trc20_network_note = data.trc20_network_note
    if data.trc20_qr_url is not None:
        s.trc20_qr_url = data.trc20_qr_url
    if data.bep20_label is not None:
        s.bep20_label = data.bep20_label
    if data.bep20_network_note is not None:
        s.bep20_network_note = data.bep20_network_note
    if data.bep20_qr_url is not None:
        s.bep20_qr_url = data.bep20_qr_url
    s.updated_by = admin.id
    s.updated_at = datetime.now(timezone.utc)
    await s.save()

    log = AdminAuditLog(
        admin_id=admin.id,
        action_type="update_payment_settings",
        entity_type="platform_payment_settings",
        entity_id=str(s.id),
        changes=[
            {"field": "trc20_address", "old_value": old_trc20, "new_value": s.trc20_address},
            {"field": "bep20_address", "old_value": old_bep20, "new_value": s.bep20_address},
        ],
    )
    await log.insert()

    return _settings_to_response(s)


@router.post("/payment-settings/upload-qr")
async def admin_upload_qr(
    network: str,
    file: UploadFile = File(...),
    admin: User = Depends(get_super_admin),
):
    """
    Upload a custom QR-code image for either the TRC20 or BEP20 deposit
    address. Replaces any previously-uploaded image. Returns the new public
    URL the broker will see on Wallet → Deposit.
    """
    if network not in ("trc20", "bep20"):
        raise HTTPException(status_code=400, detail="network must be 'trc20' or 'bep20'")

    allowed_ext = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
    import os, uuid
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Unsupported file type {ext}")

    from app.config import settings as app_settings
    max_size = app_settings.max_upload_size_mb * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail=f"File too large. Max {app_settings.max_upload_size_mb}MB")

    out_dir = os.path.join(app_settings.upload_dir, "platform_qr")
    os.makedirs(out_dir, exist_ok=True)
    fname = f"{network}_{uuid.uuid4().hex}{ext}"
    out_path = os.path.join(out_dir, fname)
    with open(out_path, "wb") as f:
        f.write(contents)

    url = f"/uploads/platform_qr/{fname}"

    # Persist on the singleton
    s = await get_or_create_settings()
    if network == "trc20":
        s.trc20_qr_url = url
    else:
        s.bep20_qr_url = url
    s.updated_by = admin.id
    s.updated_at = datetime.now(timezone.utc)
    await s.save()

    log = AdminAuditLog(
        admin_id=admin.id,
        action_type="upload_payment_qr",
        entity_type="platform_payment_settings",
        entity_id=str(s.id),
        changes=[{"field": f"{network}_qr_url", "old_value": "", "new_value": url}],
    )
    await log.insert()

    return {"url": url, "network": network}
