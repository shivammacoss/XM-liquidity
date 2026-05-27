"""
XMLiquidity — IB (Introducing Broker) Models
Direct IB, IB Community (10-level MLM), Sub-Broker accounts.
"""

from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import Field


class IBType(str, Enum):
    DIRECT = "direct"               # Earns commission per trade
    COMMUNITY = "community"         # 10-level MLM distribution
    SUB_BROKER = "sub_broker"       # Commission + business share


class IBAccount(Document):
    user_id: PydanticObjectId
    ib_type: IBType
    referral_code: str = ""          # Unique referral code for this IB

    # Tree structure
    parent_ib_id: Optional[PydanticObjectId] = None
    level: int = 1                   # Depth in the tree (1 = top)

    # Commission rates (can be overridden by admin per IB)
    commission_rate: float = 0.0     # Per-lot commission rate
    business_share_rate: float = 0.0 # Sub-broker: % of all commissions

    # Stats
    total_earned: float = 0.0
    total_referrals: int = 0
    active_referrals: int = 0
    total_trade_volume: float = 0.0

    is_active: bool = True
    approved_by: Optional[PydanticObjectId] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "ib_accounts"


class IBTree(Document):
    """
    Precomputed ancestor chain for fast 10-level lookups.
    When a user signs up under an IB, their ancestor chain is stored.
    """
    user_id: PydanticObjectId
    ancestors: List[PydanticObjectId] = Field(default_factory=list)  # [parent, grandparent, ... up to 10]
    depth: int = 0

    class Settings:
        name = "ib_tree"


class IBCommission(Document):
    """Records every commission earned by an IB from a trade."""
    ib_id: PydanticObjectId
    source_trade_id: PydanticObjectId
    source_user_id: PydanticObjectId
    amount: float = 0.0
    revenue_type: str = "commission"    # commission, spread, swap
    level: int = 1                      # Which level this commission is for

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "ib_commissions"


class IBLevelSettings(Document):
    """
    Global IB Community level distribution settings.
    Admin sets Level 1 % and decay factor.
    Can override individual levels.
    """
    level_1_pct: float = 30.0
    decay_factor: float = 0.5
    level_overrides: dict = Field(default_factory=dict)  # {"3": 10.0, "5": 3.0}
    is_active: bool = True

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "ib_level_settings"
