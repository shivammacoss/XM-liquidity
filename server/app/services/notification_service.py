"""
XMLiquidity — Notification Service
Creates notifications for users and admins.
Called from routers when actions happen (deposit, KYC, trade, etc.)
"""

from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId
from app.models.notification import (
    Notification, AdminNotification,
    NotificationType, NotificationPriority,
)
from app.models.user import User


async def notify_user(
    user_id: PydanticObjectId,
    type: NotificationType,
    title: str,
    message: str,
    priority: NotificationPriority = NotificationPriority.NORMAL,
    action_url: Optional[str] = None,
    metadata: dict = {},
    requires_action: bool = False,
):
    """Send a notification to a user."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        priority=priority,
        action_url=action_url,
        metadata=metadata,
        requires_action=requires_action,
    )
    await notif.insert()
    return notif


async def notify_admins(
    type: NotificationType,
    title: str,
    message: str,
    from_user_id: Optional[PydanticObjectId] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    metadata: dict = {},
    priority: NotificationPriority = NotificationPriority.NORMAL,
):
    """Send a notification to the admin panel."""
    from_user = None
    if from_user_id:
        from_user = await User.get(from_user_id)

    notif = AdminNotification(
        type=type,
        title=title,
        message=message,
        priority=priority,
        from_user_id=from_user_id,
        from_user_name=from_user.name if from_user else None,
        from_user_email=from_user.email if from_user else None,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata=metadata,
    )
    await notif.insert()
    return notif


# --- Convenience helpers ---

async def notify_deposit_request(user_id, amount, method, txn_id):
    await notify_admins(
        type=NotificationType.SYSTEM_MESSAGE,
        title="New Deposit Request",
        message=f"${amount} via {method}",
        from_user_id=user_id,
        entity_type="transaction",
        entity_id=str(txn_id),
        priority=NotificationPriority.HIGH,
    )


async def notify_withdrawal_request(user_id, amount, method, txn_id):
    await notify_admins(
        type=NotificationType.SYSTEM_MESSAGE,
        title="New Withdrawal Request",
        message=f"${amount} via {method}",
        from_user_id=user_id,
        entity_type="transaction",
        entity_id=str(txn_id),
        priority=NotificationPriority.HIGH,
    )


async def notify_deposit_approved(user_id, amount):
    await notify_user(
        user_id=user_id,
        type=NotificationType.DEPOSIT_APPROVED,
        title="Deposit Approved",
        message=f"Your deposit of ${amount} has been approved and credited to your wallet.",
        priority=NotificationPriority.HIGH,
        action_url="/dashboard/wallet",
    )


async def notify_deposit_rejected(user_id, amount, reason=""):
    await notify_user(
        user_id=user_id,
        type=NotificationType.DEPOSIT_REJECTED,
        title="Deposit Rejected",
        message=f"Your deposit of ${amount} was rejected. {reason}".strip(),
        priority=NotificationPriority.HIGH,
        action_url="/dashboard/wallet",
    )


async def notify_withdrawal_approved(user_id, amount):
    await notify_user(
        user_id=user_id,
        type=NotificationType.WITHDRAWAL_APPROVED,
        title="Withdrawal Approved",
        message=f"Your withdrawal of ${amount} has been processed.",
        priority=NotificationPriority.HIGH,
    )


async def notify_withdrawal_rejected(user_id, amount, reason=""):
    await notify_user(
        user_id=user_id,
        type=NotificationType.WITHDRAWAL_REJECTED,
        title="Withdrawal Rejected",
        message=f"Your withdrawal of ${amount} was rejected. Funds returned to wallet. {reason}".strip(),
        priority=NotificationPriority.HIGH,
        action_url="/dashboard/wallet",
    )


async def notify_kyc_approved(user_id):
    await notify_user(
        user_id=user_id,
        type=NotificationType.KYC_APPROVED,
        title="KYC Approved",
        message="Your identity verification has been approved. You now have full access.",
        priority=NotificationPriority.NORMAL,
    )


async def notify_kyc_rejected(user_id, reason=""):
    await notify_user(
        user_id=user_id,
        type=NotificationType.KYC_REJECTED,
        title="KYC Rejected",
        message=f"Your KYC submission was rejected. {reason}. Please resubmit.".strip(),
        priority=NotificationPriority.HIGH,
        action_url="/dashboard/profile",
    )


async def notify_fund_added(user_id, amount, note=""):
    await notify_user(
        user_id=user_id,
        type=NotificationType.FUND_ADDED,
        title="Funds Added",
        message=f"${amount} has been added to your wallet by admin. {note}".strip(),
        priority=NotificationPriority.HIGH,
        action_url="/dashboard/wallet",
    )


async def notify_fund_deducted(user_id, amount, reason=""):
    await notify_user(
        user_id=user_id,
        type=NotificationType.FUND_DEDUCTED,
        title="Funds Deducted",
        message=f"${amount} has been deducted from your wallet. {reason}".strip(),
        priority=NotificationPriority.HIGH,
        action_url="/dashboard/wallet",
    )
