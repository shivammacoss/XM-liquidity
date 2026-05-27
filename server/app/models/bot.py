"""
XMLiquidity — Bot / Algo Trading Models
Connect TradingView strategy alerts to any account.
Webhook receives alert → parses → auto-executes trade.
"""

from datetime import datetime, timezone
from typing import Optional
from enum import Enum
import secrets

from beanie import Document, PydanticObjectId
from pydantic import Field


def generate_webhook_secret() -> str:
    """Generate a unique webhook secret for each bot."""
    return secrets.token_urlsafe(32)


class BotStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"


class Bot(Document):
    user_id: PydanticObjectId
    account_id: PydanticObjectId         # Which trading account to execute on

    name: str = "My Bot"
    strategy_name: str = ""              # TradingView strategy name
    webhook_secret: str = Field(default_factory=generate_webhook_secret)

    status: BotStatus = BotStatus.ACTIVE

    # Execution settings
    default_lot_size: float = 0.01
    max_lot_size: float = 1.0
    risk_per_trade_pct: float = 0.0      # 0 = use fixed lot size
    use_sl: bool = True
    use_tp: bool = True

    # TradingView price alerts often omit strategy order — fill direction here ("buy" / "sell")
    default_order_action: str = ""
    # When alert JSON has no ticker (or webhook strips it), trade this symbol e.g. XAUUSD
    fixed_symbol: str = ""

    # Stats
    total_signals: int = 0
    total_trades_executed: int = 0
    total_pnl: float = 0.0

    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "bots"


class BotSignalStatus(str, Enum):
    EXECUTED = "executed"
    FAILED = "failed"
    IGNORED = "ignored"
    PENDING = "pending"


class BotSignal(Document):
    bot_id: PydanticObjectId
    raw_payload: dict = Field(default_factory=dict)    # Full webhook payload

    # Parsed action
    action: str = ""                      # buy, sell, close, closelong, closeshort
    instrument: str = ""
    lot_size: float = 0.0
    price: float = 0.0
    sl: float = 0.0
    tp: float = 0.0

    # Result
    trade_id: Optional[PydanticObjectId] = None
    status: BotSignalStatus = BotSignalStatus.PENDING
    error_message: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "bot_signals"
