"""
XMLiquidity — Platform Payment Settings (singleton).

Stores the global platform deposit addresses that brokers send funds to.
Currently TRC20 (USDT on Tron) and BEP20 (USDT on BSC).
Always one document; admin updates in place.
"""

from datetime import datetime, timezone
from typing import Optional

from beanie import Document, PydanticObjectId
from pydantic import Field


class PlatformPaymentSettings(Document):
    # Singleton — always read/update the first document.
    trc20_address: str = ""
    trc20_label: str = "USDT (TRC20)"
    trc20_network_note: str = "Tron Network — confirmations typically take 1-3 minutes"
    trc20_qr_url: str = ""   # Optional: admin-uploaded custom QR image

    bep20_address: str = ""
    bep20_label: str = "USDT (BEP20)"
    bep20_network_note: str = "Binance Smart Chain — confirmations typically take 1-2 minutes"
    bep20_qr_url: str = ""   # Optional: admin-uploaded custom QR image

    updated_by: Optional[PydanticObjectId] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "platform_payment_settings"


async def get_or_create_settings() -> PlatformPaymentSettings:
    """Return the singleton settings doc, creating it if missing."""
    doc = await PlatformPaymentSettings.find_one()
    if not doc:
        doc = PlatformPaymentSettings()
        await doc.insert()
    return doc
