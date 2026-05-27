"""
XMLiquidity — Banking Settings Model
User's saved banking/crypto withdrawal details.
"""

from datetime import datetime, timezone
from typing import Optional
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import Field


class BankingType(str, Enum):
    CRYPTO_BTC = "crypto_btc"
    CRYPTO_ETH = "crypto_eth"
    CRYPTO_USDT = "crypto_usdt"
    BANK_ACCOUNT = "bank_account"


class BankingDetail(Document):
    user_id: PydanticObjectId
    type: BankingType
    label: str = ""                        # User-friendly name ("My BTC Wallet", "HDFC Bank")
    is_default: bool = False

    # Crypto fields
    wallet_address: Optional[str] = None
    network: Optional[str] = None          # "TRC20", "ERC20", "BTC"

    # Bank fields
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None        # Or SWIFT/BIC for international
    swift_code: Optional[str] = None
    iban: Optional[str] = None
    bank_address: Optional[str] = None

    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "banking_details"
