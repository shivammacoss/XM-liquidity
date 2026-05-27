"""
XMLiquidity — Wallet Model
Each user has one wallet. Deposits/withdrawals/transfers all go through wallet.
"""

from datetime import datetime, timezone
from beanie import Document, PydanticObjectId
from pydantic import Field


class Wallet(Document):
    user_id: PydanticObjectId  # One wallet per user
    balance: float = 0.0
    currency: str = "USD"

    # Totals for dashboard stats
    total_deposited: float = 0.0
    total_withdrawn: float = 0.0
    total_transferred: float = 0.0  # Internal transfers to/from accounts

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "wallets"
