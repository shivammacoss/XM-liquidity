"""
XMLiquidity — Charge Settings Model
Priority-based charge system:
  User-specific > Account-type-specific > Default

Admin sets charges at 3 levels. When calculating a trade's charges,
the system checks user override first, then account type, then default.
"""

from datetime import datetime, timezone
from typing import Optional
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import Field


class ChargeLevel(str, Enum):
    DEFAULT = "default"              # Global default for all users
    ACCOUNT_TYPE = "account_type"    # Per account type (e.g. ECN gets 0.6 spread)
    USER = "user"                    # Per individual user override


class ChargeSettings(Document):
    level: ChargeLevel
    target_id: Optional[str] = None       # Account type string or user ID
    instrument_id: Optional[str] = None   # Instrument symbol or None for all
    segment: Optional[str] = None         # Apply to entire segment

    # Charges
    spread_markup: float = 0.0            # Additional spread in pips
    swap_long: float = 0.0                # Swap for long positions (per lot/day)
    swap_short: float = 0.0               # Swap for short positions (per lot/day)
    commission_per_lot: float = 0.0       # Commission per lot traded

    # Priority (higher wins)
    priority: int = 0                     # default=0, account_type=10, user=20

    is_active: bool = True

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "charge_settings"
