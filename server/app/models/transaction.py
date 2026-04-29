"""
SwisTrade — Transaction Model
Records all wallet operations: deposits, withdrawals, internal transfers, prop purchases.
"""

from datetime import datetime, timezone
from typing import Optional
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import Field


class TransactionType(str, Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    INTERNAL_TRANSFER = "internal_transfer"      # Wallet → Account or Account → Wallet
    PROP_PURCHASE = "prop_purchase"
    PROP_PAYOUT = "prop_payout"                   # Funded-challenge profit payout
    COMMISSION = "commission"                     # IB/sub-broker commission credit
    PROFIT_SHARE = "profit_share"                 # PAMM profit distribution


class TransactionMethod(str, Enum):
    CRYPTO_BTC = "crypto_btc"
    CRYPTO_ETH = "crypto_eth"
    CRYPTO_USDT = "crypto_usdt"
    BANK_WIRE = "bank_wire"
    INTERNAL = "internal"                         # System-generated (transfers, commissions)


class TransactionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Transaction(Document):
    user_id: PydanticObjectId
    type: TransactionType
    method: TransactionMethod = TransactionMethod.INTERNAL
    status: TransactionStatus = TransactionStatus.PENDING

    amount: float = 0.0
    currency: str = "USD"

    # For crypto deposits
    crypto_txn_hash: Optional[str] = None
    memo_tag: Optional[str] = None       # User's unique memo for platform address
    from_address: Optional[str] = None

    # For internal transfers
    from_account_id: Optional[PydanticObjectId] = None  # Trading account or wallet
    to_account_id: Optional[PydanticObjectId] = None

    # For prop purchases / payouts
    prop_account_id: Optional[PydanticObjectId] = None

    # Free-form payment payload (kind="prop_payout" carries challenge_account_id,
    # profit, split_pct; kind="bank_wire" carries account number; etc.)
    payment_details: dict = Field(default_factory=dict)

    # User note attached at request time (e.g. payout description)
    user_note: Optional[str] = None

    # Rejection reason (separate from admin_notes for clarity)
    rejection_reason: Optional[str] = None

    # Admin review
    admin_notes: Optional[str] = None
    reviewed_by: Optional[PydanticObjectId] = None
    reviewed_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "transactions"
