"""
XMLiquidity — Notification Model
System notifications for users and admins.
Types: deposit_approved, deposit_rejected, withdrawal_approved, kyc_approved,
       admin_message, trade_alert, prop_blown, challenge_result, etc.
"""

from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import Field


class NotificationType(str, Enum):
    # Transaction notifications
    DEPOSIT_APPROVED = "deposit_approved"
    DEPOSIT_REJECTED = "deposit_rejected"
    WITHDRAWAL_APPROVED = "withdrawal_approved"
    WITHDRAWAL_REJECTED = "withdrawal_rejected"

    # KYC
    KYC_APPROVED = "kyc_approved"
    KYC_REJECTED = "kyc_rejected"

    # Trading
    TRADE_ALERT = "trade_alert"
    SL_HIT = "sl_hit"
    TP_HIT = "tp_hit"

    # Prop
    PROP_BLOWN = "prop_blown"
    PROP_PHASE_PASSED = "prop_phase_passed"
    PROP_FUNDED = "prop_funded"

    # Copy Trading
    COPY_MASTER_APPROVED = "copy_master_approved"
    COPY_MASTER_REJECTED = "copy_master_rejected"

    # Challenges
    CHALLENGE_RESULT = "challenge_result"

    # Admin actions
    ACCOUNT_BLOCKED = "account_blocked"
    ACCOUNT_UNBLOCKED = "account_unblocked"
    TRADING_RESTRICTED = "trading_restricted"
    FUND_ADDED = "fund_added"
    FUND_DEDUCTED = "fund_deducted"

    # General
    ADMIN_MESSAGE = "admin_message"
    SYSTEM_MESSAGE = "system_message"


class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class Notification(Document):
    user_id: PydanticObjectId              # Who receives this notification
    type: NotificationType
    title: str
    message: str
    priority: NotificationPriority = NotificationPriority.NORMAL

    # Optional metadata
    action_url: Optional[str] = None       # Link to relevant page
    metadata: dict = Field(default_factory=dict)  # Extra data (txn_id, trade_id, etc.)

    # Status
    is_read: bool = False
    read_at: Optional[datetime] = None

    # For approve/reject type notifications (admin action required)
    requires_action: bool = False
    action_status: Optional[str] = None    # pending, approved, rejected
    action_by: Optional[PydanticObjectId] = None
    action_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "notifications"


class AdminNotification(Document):
    """Notifications specifically for admin panel."""
    type: NotificationType
    title: str
    message: str
    priority: NotificationPriority = NotificationPriority.NORMAL

    # Who triggered it
    from_user_id: Optional[PydanticObjectId] = None
    from_user_name: Optional[str] = None
    from_user_email: Optional[str] = None

    # Related entity
    entity_type: Optional[str] = None      # "transaction", "kyc", "copy_master", etc.
    entity_id: Optional[str] = None

    metadata: dict = Field(default_factory=dict)

    # Status
    is_read: bool = False
    read_at: Optional[datetime] = None

    # Action taken
    action_status: Optional[str] = None
    action_by: Optional[PydanticObjectId] = None
    action_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "admin_notifications"
