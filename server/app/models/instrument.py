"""
XMLiquidity — Instrument Model
All tradeable instruments (forex pairs, crypto, metals, indices, stocks).
Admin can add/hide/configure instruments.
"""

from datetime import datetime, timezone
from typing import Optional
from enum import Enum

from beanie import Document
from pydantic import Field


class Segment(str, Enum):
    FOREX = "forex"
    CRYPTO = "crypto"
    METALS = "metals"
    INDICES = "indices"
    STOCKS = "stocks"
    ENERGY = "energy"


class Instrument(Document):
    symbol: str                          # e.g. "EURUSD", "BTCUSD", "XAUUSD"
    display_name: str                    # e.g. "EUR/USD", "BTC/USD"
    segment: Segment
    base_currency: str = ""              # e.g. "EUR"
    quote_currency: str = ""             # e.g. "USD"

    # Pricing config
    pip_size: float = 0.0001             # 0.0001 for forex, 0.01 for JPY pairs
    lot_size: float = 100000             # Standard lot size
    min_lot: float = 0.01
    max_lot: float = 100.0
    lot_step: float = 0.01

    # Trading hours
    trading_hours: str = "24/5"          # e.g. "24/5", "24/7" for crypto

    # Visibility
    is_active: bool = True
    is_hidden: bool = False              # Hidden from users but still exists
    sort_order: int = 0                  # Display ordering

    # InfoWay API symbol mapping
    infoway_symbol: Optional[str] = None  # Symbol as used in InfoWay API

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "instruments"
