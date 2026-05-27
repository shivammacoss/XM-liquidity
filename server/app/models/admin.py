"""
XMLiquidity — Admin Models
Audit log, sub-admin permissions, account type settings, platform settings.
"""

from datetime import datetime, timezone
from typing import Optional, List

from beanie import Document, PydanticObjectId
from pydantic import Field


class AdminAuditLog(Document):
    """Every admin action is logged for accountability."""
    admin_id: PydanticObjectId
    action_type: str                      # e.g. "modify_trade", "block_user", "approve_kyc"
    entity_type: str                      # e.g. "trade", "user", "prop_account"
    entity_id: str                        # ID of the affected entity
    changes: List[dict] = Field(default_factory=list)
    # Each: {"field": "open_price", "old_value": 1.1050, "new_value": 1.1060}

    ip_address: str = ""
    user_agent: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "admin_audit_log"


class SubAdminPermissions(Document):
    """Granular permissions for sub-admin accounts."""
    user_id: PydanticObjectId
    permissions: List[str] = Field(default_factory=list)
    # Available permissions:
    # "manage_users", "view_trades", "modify_trades",
    # "manage_kyc", "manage_accounts", "manage_deposits",
    # "manage_withdrawals", "manage_instruments", "manage_charges",
    # "manage_ib", "manage_copy_trading", "manage_challenges",
    # "view_risk", "manage_prop", "manage_bots"

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "sub_admin_permissions"


class AccountTypeSettings(Document):
    """Admin-configurable defaults per account type."""
    account_type: str                     # ecn, standard, raw, elite, islamic, cent
    display_name: str = ""
    description: str = ""

    min_deposit: float = 25.0
    default_leverage: int = 100
    max_leverage: int = 500
    swap_enabled: bool = True             # False for Islamic accounts
    overnight_charge: float = 0.0
    overnight_max_holdings: int = 0       # 0 = unlimited

    is_active: bool = True
    sort_order: int = 0

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "account_type_settings"


class PlatformSettings(Document):
    """Global platform configuration (key-value store)."""
    key: str
    value: str
    description: str = ""

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "platform_settings"
