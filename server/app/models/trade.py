"""
XMLiquidity — Trade Model
Every trade placed by any user on any account.
Supports: market, limit, stop limit, target limit orders.
"""

from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import Field


class TradeDirection(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP_LIMIT = "stop_limit"
    TARGET_LIMIT = "target_limit"


class TradeStatus(str, Enum):
    PENDING = "pending"          # Limit/stop order waiting to trigger
    OPEN = "open"                # Active trade
    CLOSED = "closed"            # Manually or TP/SL hit
    PARTIALLY_CLOSED = "partially_closed"
    CANCELLED = "cancelled"      # Pending order cancelled


class AdminModifyLog(dict):
    """Tracks admin changes to trades for audit."""
    pass


class Trade(Document):
    account_id: PydanticObjectId
    user_id: PydanticObjectId
    instrument: str                      # e.g. "EURUSD", "BTCUSD", "XAUUSD"
    segment: str = "forex"               # forex, crypto, metals, indices, stocks

    direction: TradeDirection
    order_type: OrderType = OrderType.MARKET
    status: TradeStatus = TradeStatus.OPEN

    # Lot & pricing
    lot_size: float = 0.01
    open_price: float = 0.0
    close_price: Optional[float] = None
    current_price: float = 0.0           # Live price for P&L calc

    # SL / TP
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

    # For limit/stop orders
    trigger_price: Optional[float] = None
    limit_price: Optional[float] = None

    # Leverage used for this trade
    leverage: int = 100

    # Margin locked for this trade
    margin_used: float = 0.0

    # P&L
    pnl: float = 0.0                     # Realized P&L (set on close)
    unrealized_pnl: float = 0.0          # Running P&L (updated by price feed)
    swap: float = 0.0                    # Overnight swap charges accumulated

    # Charges applied
    spread_charged: float = 0.0
    swap_charged: float = 0.0
    commission_charged: float = 0.0

    # Partial close tracking
    original_lot_size: float = 0.0       # Original lot before partial closes
    partial_closes: List[dict] = Field(default_factory=list)
    # Each: {lot_size, close_price, pnl, closed_at}

    # Admin modifications
    is_admin_modified: bool = False
    admin_modify_log: List[dict] = Field(default_factory=list)
    # Each: {admin_id, field, old_value, new_value, modified_at}

    # Copy trading link
    is_copy_trade: bool = False
    master_trade_id: Optional[PydanticObjectId] = None

    # Bot trade link
    is_bot_trade: bool = False
    bot_id: Optional[PydanticObjectId] = None

    # Timestamps
    open_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    close_time: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "trades"

    @property
    def is_profitable(self) -> bool:
        return self.pnl > 0 if self.status == TradeStatus.CLOSED else self.unrealized_pnl > 0
