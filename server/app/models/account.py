"""
XMLiquidity — Trading Account Model
6 account types: ECN, Standard, Raw, Elite, Islamic, Cent
Account opens empty, trading locked until funded.
"""

from datetime import datetime, timezone
from typing import Optional
from enum import Enum
import random
import string

from beanie import Document, PydanticObjectId
from pydantic import Field


class AccountType(str, Enum):
    ECN = "ecn"
    STANDARD = "standard"
    RAW = "raw"
    ELITE = "elite"
    ISLAMIC = "islamic"
    CENT = "cent"


class AccountStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    CLOSED = "closed"


def generate_account_number() -> str:
    """Generate unique 8-digit account number with ST prefix."""
    digits = ''.join(random.choices(string.digits, k=8))
    return f"ST{digits}"


class TradingAccount(Document):
    user_id: PydanticObjectId
    account_type: AccountType
    account_number: str = Field(default_factory=generate_account_number)

    # Balances
    balance: float = 0.0        # Available balance
    equity: float = 0.0         # Balance + unrealized P&L
    margin_used: float = 0.0    # Margin locked in open trades
    free_margin: float = 0.0    # Equity - margin_used
    initial_deposit: float = 0.0  # First deposit amount (for prop tracking)

    # Settings
    leverage: int = 100         # Default leverage (e.g. 100 = 1:100)
    currency: str = "USD"

    # Status
    is_funded: bool = False     # Trading locked until first deposit
    status: AccountStatus = AccountStatus.ACTIVE

    # Prop challenge link (if this account is part of a prop challenge)
    prop_account_id: Optional[PydanticObjectId] = None
    is_prop_account: bool = False

    # Copy/PAMM link
    is_copy_master: bool = False
    is_pamm_account: bool = False

    # Stats (updated on trade close)
    total_trades: int = 0
    total_pnl: float = 0.0
    win_count: int = 0
    loss_count: int = 0

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "trading_accounts"

    @property
    def win_rate(self) -> float:
        if self.total_trades == 0:
            return 0.0
        return round((self.win_count / self.total_trades) * 100, 2)
