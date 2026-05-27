"""
XMLiquidity — Challenge & Competition Models
Daily/weekly/monthly challenges with leaderboard.
Categories: best performer, best lot handler, best holders, best positive traders.
"""

from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import Field


class ChallengeType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class ChallengeStatus(str, Enum):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ChallengeCategory(str, Enum):
    BEST_PERFORMER = "best_performer"         # Highest P&L
    BEST_LOT_HANDLER = "best_lot_handler"     # Best lot size management
    BEST_HOLDER = "best_holder"               # Longest profitable hold times
    BEST_POSITIVE = "best_positive"           # Highest win rate


class Challenge(Document):
    title: str
    description: str = ""
    type: ChallengeType
    category: ChallengeCategory = ChallengeCategory.BEST_PERFORMER

    # Eligibility
    qualifying_account_types: List[str] = Field(default_factory=list)  # Empty = all
    min_account_balance: float = 0.0
    entry_fee: float = 0.0

    # Timing
    start_at: datetime
    end_at: datetime
    status: ChallengeStatus = ChallengeStatus.UPCOMING

    # Rewards
    rewards: dict = Field(default_factory=dict)
    # {
    #   "1st": {"prize": 1000, "title": "Champion"},
    #   "2nd": {"prize": 500},
    #   "3rd": {"prize": 250},
    # }

    # Stats
    participant_count: int = 0

    created_by: Optional[PydanticObjectId] = None   # Admin who created it
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "challenges"


class ChallengeEntry(Document):
    challenge_id: PydanticObjectId
    user_id: PydanticObjectId
    account_id: PydanticObjectId

    # Metrics tracked during challenge
    metrics: dict = Field(default_factory=dict)
    # {
    #   "total_pnl": 0,
    #   "lots_traded": 0,
    #   "total_trades": 0,
    #   "win_count": 0,
    #   "loss_count": 0,
    #   "win_rate": 0,
    #   "avg_hold_time_minutes": 0,
    #   "max_drawdown": 0,
    #   "best_trade_pnl": 0,
    #   "worst_trade_pnl": 0,
    # }

    score: float = 0.0
    rank: int = 0

    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "challenge_entries"
