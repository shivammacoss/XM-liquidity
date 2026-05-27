"""
XMLiquidity — Copy Trading + PAMM Models
Signal-based copy trading with auto-execute and configurable lot multiplier.
PAMM accounts with admin-set profit share %.
"""

from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import Field


class MasterStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    BLOCKED = "blocked"


class CopyMaster(Document):
    """A trader who has been approved to share signals."""
    user_id: PydanticObjectId
    account_id: PydanticObjectId         # The trading account being copied

    status: MasterStatus = MasterStatus.PENDING
    charge_per_trade: float = 0.0        # Fee per copied trade
    charge_monthly: float = 0.0          # Monthly subscription fee

    # Stats
    subscriber_count: int = 0
    total_pnl: float = 0.0
    total_trades: int = 0
    win_rate: float = 0.0

    approved_by: Optional[PydanticObjectId] = None
    approved_at: Optional[datetime] = None

    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "copy_masters"


class CopySubscription(Document):
    """A follower subscribing to a master's signals."""
    follower_id: PydanticObjectId        # User ID of follower
    master_id: PydanticObjectId          # CopyMaster document ID
    follower_account_id: PydanticObjectId  # Account where trades are copied

    lot_multiplier: float = 1.0          # 0.5x, 1x, 2x etc of master's lot size
    is_active: bool = True

    total_copied_trades: int = 0
    total_pnl: float = 0.0

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "copy_subscriptions"


class CopySignal(Document):
    """Record of each signal propagated from master to followers."""
    master_id: PydanticObjectId
    master_trade_id: PydanticObjectId
    signal_type: str = "open"            # open, close, modify
    instrument: str = ""
    direction: str = ""
    lot_size: float = 0.0
    price: float = 0.0

    # Follower execution results
    executed_for: List[dict] = Field(default_factory=list)
    # Each: {follower_id, follower_trade_id, lot_size, status}

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "copy_signals"


# --- PAMM ---

class PAMMStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    BLOCKED = "blocked"
    CLOSED = "closed"


class PAMMInvestor(dict):
    """Embedded investor within a PAMM account."""
    pass
    # Structure:
    # {
    #   "user_id": "...",
    #   "amount_invested": 5000,
    #   "share_pct": 25.0,
    #   "joined_at": "...",
    #   "total_profit": 0,
    # }


class PAMMAccount(Document):
    """Managed investment account where manager trades, investors share profits."""
    manager_id: PydanticObjectId         # User ID of PAMM manager
    account_id: PydanticObjectId         # The trading account

    total_pool: float = 0.0              # Total invested amount
    profit_share_pct: float = 20.0       # Manager's cut (set by admin)
    management_fee_pct: float = 0.0      # Annual management fee

    investors: List[dict] = Field(default_factory=list)  # PAMMInvestor dicts

    status: PAMMStatus = PAMMStatus.PENDING
    approved_by: Optional[PydanticObjectId] = None
    approved_at: Optional[datetime] = None

    total_pnl: float = 0.0
    total_trades: int = 0

    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "pamm_accounts"
