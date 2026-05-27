"""
XMLiquidity — Admin Notifications + User Fund Management + Login-As-User
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from typing import Optional

from app.middleware.auth import get_admin_user, get_super_admin
from app.models.user import User
from app.models.wallet import Wallet
from app.models.notification import AdminNotification, Notification
from app.models.transaction import Transaction, TransactionType, TransactionMethod, TransactionStatus
from app.models.admin import AdminAuditLog
from app.services.notification_service import notify_fund_added, notify_fund_deducted, notify_user
from app.models.notification import NotificationType, NotificationPriority
from app.utils.security import create_access_token

router = APIRouter(prefix="/admin", tags=["Admin Notifications & Fund Mgmt"])


# ==========================================
# ADMIN NOTIFICATIONS
# ==========================================

@router.get("/notifications")
async def list_admin_notifications(
    admin: User = Depends(get_admin_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    unread_only: bool = Query(False),
):
    """List admin panel notifications."""
    query = AdminNotification.find()
    if unread_only:
        query = query.find(AdminNotification.is_read == False)

    total = await query.count()
    unread = await AdminNotification.find(AdminNotification.is_read == False).count()
    skip = (page - 1) * per_page
    notifs = await query.sort("-created_at").skip(skip).limit(per_page).to_list()

    return {
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type.value,
                "title": n.title,
                "message": n.message,
                "priority": n.priority.value,
                "from_user_name": n.from_user_name,
                "from_user_email": n.from_user_email,
                "entity_type": n.entity_type,
                "entity_id": n.entity_id,
                "is_read": n.is_read,
                "action_status": n.action_status,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifs
        ],
        "total": total,
        "unread_count": unread,
        "page": page,
    }


@router.get("/notifications/unread-count")
async def admin_unread_count(admin: User = Depends(get_admin_user)):
    """Get admin unread notification count."""
    count = await AdminNotification.find(AdminNotification.is_read == False).count()
    return {"unread_count": count}


@router.post("/notifications/{notif_id}/read")
async def mark_admin_notification_read(notif_id: str, admin: User = Depends(get_admin_user)):
    """Mark an admin notification as read."""
    notif = await AdminNotification.get(notif_id)
    if notif:
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        await notif.save()
    return {"message": "Marked as read"}


@router.post("/notifications/read-all")
async def mark_all_admin_read(admin: User = Depends(get_admin_user)):
    """Mark all admin notifications as read."""
    await AdminNotification.find(
        AdminNotification.is_read == False
    ).update({"$set": {"is_read": True, "read_at": datetime.now(timezone.utc)}})
    return {"message": "All marked as read"}


@router.post("/notifications/broadcast")
async def broadcast_to_users(
    title: str = Query(...),
    message: str = Query(...),
    admin: User = Depends(get_super_admin),
):
    """Broadcast a notification to all active users."""
    users = await User.find(User.is_active == True, User.role == "user").to_list()
    count = 0
    for u in users:
        await notify_user(
            user_id=u.id,
            type=NotificationType.ADMIN_MESSAGE,
            title=title,
            message=message,
            priority=NotificationPriority.HIGH,
        )
        count += 1
    return {"message": f"Broadcast sent to {count} users"}


# ==========================================
# ADD / DEDUCT FUND
# ==========================================

class FundActionRequest(BaseModel):
    user_id: str
    amount: float = Field(..., gt=0, le=10000000)
    note: str = Field("", max_length=500)


@router.post("/users/add-fund")
async def admin_add_fund(data: FundActionRequest, admin: User = Depends(get_admin_user)):
    """Admin directly adds funds to a user's wallet."""
    user = await User.get(data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    wallet = await Wallet.find_one(Wallet.user_id == user.id)
    if not wallet:
        wallet = Wallet(user_id=user.id)
        await wallet.insert()

    wallet.balance += data.amount
    wallet.total_deposited += data.amount
    wallet.updated_at = datetime.now(timezone.utc)
    await wallet.save()

    # Record transaction
    txn = Transaction(
        user_id=user.id,
        type=TransactionType.DEPOSIT,
        method=TransactionMethod.INTERNAL,
        status=TransactionStatus.COMPLETED,
        amount=data.amount,
        admin_notes=f"Admin fund add: {data.note}",
        reviewed_by=admin.id,
        reviewed_at=datetime.now(timezone.utc),
    )
    await txn.insert()

    # Audit log
    await AdminAuditLog(
        admin_id=admin.id,
        action_type="add_fund",
        entity_type="wallet",
        entity_id=str(wallet.id),
        changes=[{"field": "balance", "old_value": wallet.balance - data.amount, "new_value": wallet.balance}],
    ).insert()

    # Notify user
    await notify_fund_added(user.id, data.amount, data.note)

    return {
        "message": f"${data.amount} added to {user.email}'s wallet",
        "new_balance": round(wallet.balance, 2),
    }


@router.post("/users/deduct-fund")
async def admin_deduct_fund(data: FundActionRequest, admin: User = Depends(get_admin_user)):
    """Admin deducts funds from a user's wallet."""
    user = await User.get(data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    wallet = await Wallet.find_one(Wallet.user_id == user.id)
    if not wallet or wallet.balance < data.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Current: ${wallet.balance if wallet else 0}")

    wallet.balance -= data.amount
    wallet.updated_at = datetime.now(timezone.utc)
    await wallet.save()

    # Record transaction
    txn = Transaction(
        user_id=user.id,
        type=TransactionType.WITHDRAWAL,
        method=TransactionMethod.INTERNAL,
        status=TransactionStatus.COMPLETED,
        amount=data.amount,
        admin_notes=f"Admin fund deduct: {data.note}",
        reviewed_by=admin.id,
        reviewed_at=datetime.now(timezone.utc),
    )
    await txn.insert()

    # Audit log
    await AdminAuditLog(
        admin_id=admin.id,
        action_type="deduct_fund",
        entity_type="wallet",
        entity_id=str(wallet.id),
        changes=[{"field": "balance", "old_value": wallet.balance + data.amount, "new_value": wallet.balance}],
    ).insert()

    # Notify user
    await notify_fund_deducted(user.id, data.amount, data.note)

    return {
        "message": f"${data.amount} deducted from {user.email}'s wallet",
        "new_balance": round(wallet.balance, 2),
    }


# ==========================================
# LOGIN AS USER
# ==========================================

@router.post("/users/{user_id}/login-as")
async def admin_login_as_user(user_id: str, request: Request, admin: User = Depends(get_super_admin)):
    """Super admin can login as any user (impersonation). Logged in audit."""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create impersonation token
    token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value, "impersonated_by": str(admin.id)}
    )

    # Record in session
    from app.models.session import Session
    session = Session(
        user_id=user.id,
        device_info="Admin Impersonation",
        ip_address=request.headers.get("X-Forwarded-For", request.client.host if request.client else ""),
        is_active=True,
        is_impersonation=True,
        impersonated_by=admin.id,
    )
    await session.insert()

    # Audit
    await AdminAuditLog(
        admin_id=admin.id,
        action_type="login_as_user",
        entity_type="user",
        entity_id=user_id,
        changes=[{"field": "impersonation", "old_value": None, "new_value": user.email}],
    ).insert()

    from app.services.auth_service import user_to_public
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_to_public(user).model_dump(),
        "message": f"Logged in as {user.email}. This session is recorded.",
    }
