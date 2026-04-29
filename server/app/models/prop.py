"""
SwisTrade — Prop Challenge Models
One-step, Two-step, Instant Fund accounts with real-time rule enforcement.

Brought to feature parity with bharat_funded:
- PropSettings becomes the per-admin master toggle (challengeModeEnabled,
  displayName, description, terms, autoCloseAtMarketClose)
- PropChallenge is the catalog row admin creates (multi-tier pricing,
  full risk-rule schema, fundedSettings)
- PropAccount tracks isolated sub-wallet, violations, daily-pnl map,
  trading days, withdrawal cooldown, profit split
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field


class PropType(str, Enum):
    ONE_STEP = "one_step"
    TWO_STEP = "two_step"
    INSTANT_FUND = "instant_fund"


class PhaseStatus(str, Enum):
    ACTIVE = "active"
    PASSED = "passed"
    FAILED = "failed"
    BLOWN = "blown"


class PropAccountStatus(str, Enum):
    ACTIVE = "active"
    PASSED = "passed"
    FUNDED = "funded"
    BLOWN = "blown"
    EXPIRED = "expired"


class ViolationSeverity(str, Enum):
    WARNING = "warning"
    FAIL = "fail"


class PropTier(BaseModel):
    """One (account_size, price) option inside a challenge's pricing grid."""
    account_size: float
    price: float
    label: str = ""
    is_popular: bool = False


class PropViolation(BaseModel):
    rule: str
    description: str
    severity: ViolationSeverity = ViolationSeverity.WARNING
    trade_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PropFundedSettings(BaseModel):
    profit_split_pct: float = 80.0
    max_withdrawal_pct: Optional[float] = None
    withdrawal_cooldown_days: int = 14


class PropAccount(Document):
    user_id: PydanticObjectId
    challenge_id: Optional[PydanticObjectId] = None  # Link to PropChallenge
    prop_type: PropType
    account_size: float
    price_paid: float
    currency: str = "USD"

    status: PropAccountStatus = PropAccountStatus.ACTIVE
    current_phase: int = 1
    total_phases: int = 1

    phases: List[dict] = Field(default_factory=list)
    risk_rules: dict = Field(default_factory=dict)

    trading_account_id: Optional[PydanticObjectId] = None
    live_account_id: Optional[PydanticObjectId] = None

    # Isolated sub-wallet — virtual money for this challenge only.
    # The user's main Wallet is NEVER touched by trades on this account.
    sub_wallet_balance: float = 0.0
    sub_wallet_equity: float = 0.0
    sub_wallet_margin: float = 0.0
    sub_wallet_free_margin: float = 0.0

    # Drawdown tracking
    phase_start_balance: float = 0.0
    day_start_equity: Optional[float] = None
    lowest_equity_today: Optional[float] = None
    lowest_equity_overall: Optional[float] = None
    highest_equity: Optional[float] = None
    current_daily_drawdown_pct: float = 0.0
    current_overall_drawdown_pct: float = 0.0
    max_daily_drawdown_hit: float = 0.0
    max_overall_drawdown_hit: float = 0.0

    # Profit tracking
    current_profit_pct: float = 0.0
    total_profit_loss: float = 0.0

    # Trade counters
    trades_today: int = 0
    open_trades_count: int = 0
    total_trades: int = 0
    trading_days_count: int = 0
    last_trading_day: Optional[datetime] = None
    unique_trading_days: List[str] = Field(default_factory=list)  # YYYY-MM-DD
    daily_pnl_map: Dict[str, float] = Field(default_factory=dict)  # YYYY-MM-DD → pnl

    # Violations / warnings
    violations: List[dict] = Field(default_factory=list)  # PropViolation dicts
    warnings_count: int = 0

    # Funded-specific
    profit_split_pct: float = 80.0
    total_withdrawn: float = 0.0
    last_withdrawal_date: Optional[datetime] = None

    # Blow tracking
    is_blown: bool = False
    blown_reason: Optional[str] = None
    blown_at: Optional[datetime] = None
    blown_rule: Optional[str] = None

    # Pass tracking
    passed_at: Optional[datetime] = None
    expired_at: Optional[datetime] = None

    # Lifecycle
    expires_at: Optional[datetime] = None
    purchased_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "prop_accounts"


class PropChallenge(Document):
    """
    Admin-created challenge offering. Replaces the old single-row PropSettings
    catalog. Supports multi-tier pricing — one challenge can expose several
    (account_size, price) tiers and the user picks one at buy time.
    """
    admin_id: Optional[PydanticObjectId] = None  # Owning admin (sub-admin scoping)
    name: str
    description: str = ""
    prop_type: PropType = PropType.TWO_STEP
    steps_count: int = 2  # 0 = instant, 1 = one-step, 2 = two-step
    currency: str = "USD"

    # Legacy single-tier (back-compat). New challenges use `tiers`.
    account_size: float = 0.0
    price: float = 0.0

    # Multi-tier pricing
    tiers: List[PropTier] = Field(default_factory=list)

    # Risk rules (drawdown, profit target, lot limits, leverage, time, etc.)
    rules: dict = Field(default_factory=lambda: {
        "max_daily_loss_pct": 5.0,
        "max_total_loss_pct": 10.0,
        "max_loss_per_trade_pct": 2.0,
        "profit_target_phase1_pct": 8.0,
        "profit_target_phase2_pct": 5.0,
        "profit_target_instant_pct": 0.0,
        "max_one_day_profit_pct_of_target": None,
        "consistency_rule_pct": None,
        "min_lot_size": 0.01,
        "max_lot_size": 100.0,
        "allow_fractional_lots": True,
        "min_trades_required": 1,
        "max_trades_per_day": None,
        "max_total_trades": None,
        "max_concurrent_trades": None,
        "stop_loss_required": False,
        "take_profit_required": False,
        "min_trade_hold_seconds": 0,
        "max_trade_hold_seconds": None,
        "allow_weekend_holding": False,
        "allow_news_trading": True,
        "max_leverage": 100,
        "allowed_symbols": [],
        "allowed_segments": [],
        "trading_days_required": None,
        "challenge_expiry_days": 30,
        "trading_hours_start": None,
        "trading_hours_end": None,
    })

    funded_settings: dict = Field(default_factory=lambda: {
        "profit_split_pct": 80.0,
        "max_withdrawal_pct": None,
        "withdrawal_cooldown_days": 14,
    })

    is_active: bool = True
    sort_order: int = 0

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "prop_challenges"


class PropSettings(Document):
    """
    Per-admin master toggle for prop / challenge mode. Mirrors bharat_funded
    PropSettings: a single row per admin (or null adminId for global default)
    holding the on/off switch and presentation strings.

    NOTE: the legacy single-tier-per-doc shape is kept on this same model for
    back-compat with existing /prop/available data; new admin work goes
    through PropChallenge instead.
    """
    admin_id: Optional[PydanticObjectId] = None

    # Master controls (new — bharat_funded parity)
    challenge_mode_enabled: bool = True
    display_name: str = "Prop Trading Challenge"
    description: str = "Trade with our capital. Pass the challenge and get funded."
    terms_and_conditions: str = ""
    auto_close_at_market_close: bool = False

    # Legacy single-row catalog fields (kept for back-compat with /prop/available
    # endpoint that pre-dates PropChallenge). Admin should prefer PropChallenge
    # going forward. These get default-zeroed when used as a master toggle row.
    prop_type: Optional[PropType] = None
    account_size: float = 0.0
    price: float = 0.0
    phases_count: int = 1
    is_active: bool = True

    max_daily_loss_pct: float = 5.0
    max_total_loss_pct: float = 10.0
    profit_target_pct: float = 8.0
    min_trading_days: int = 5
    max_trading_days: int = 30
    sl_required: bool = True
    tp_required: bool = False
    max_lot_size: float = 10.0
    max_leverage: int = 100
    partial_close_required: bool = False
    daily_trade_limit: int = 0
    max_open_trades: int = 0

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "prop_settings"
