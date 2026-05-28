"""
XMLiquidity — Database Connection
Secure MongoDB connection via Motor (async) + Beanie ODM.
Connection string is NEVER exposed to frontend or logs.
"""

import ssl
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.config import settings

# Import all document models
from app.models.user import User
from app.models.session import Session
from app.models.account import TradingAccount
from app.models.wallet import Wallet
from app.models.transaction import Transaction
from app.models.trade import Trade
from app.models.instrument import Instrument
from app.models.charge import ChargeSettings
from app.models.prop import PropAccount, PropSettings, PropChallenge
from app.models.ib import IBAccount, IBTree, IBCommission, IBLevelSettings
from app.models.copy_trading import CopyMaster, CopySubscription, CopySignal, PAMMAccount
from app.models.bot import Bot, BotSignal
from app.models.challenge import Challenge, ChallengeEntry
from app.models.kyc import KYCDocument
from app.models.admin import AdminAuditLog, SubAdminPermissions, AccountTypeSettings, PlatformSettings
from app.models.notification import Notification, AdminNotification
from app.models.banking import BankingDetail
from app.models.platform_settings import PlatformPaymentSettings
from app.models.signup_request import SignupRequest

_client: AsyncIOMotorClient | None = None


async def init_db():
    """Initialize MongoDB connection and Beanie ODM with all models."""
    global _client

    # Use TLS only for Atlas (mongodb+srv), not for local MongoDB
    client_options = {
        "maxPoolSize": 50,
        "minPoolSize": 10,
        "serverSelectionTimeoutMS": 5000,
    }
    if settings.mongodb_url.startswith("mongodb+srv"):
        client_options["tlsCAFile"] = certifi.where()
    
    _client = AsyncIOMotorClient(settings.mongodb_url, **client_options)

    await init_beanie(
        database=_client[settings.mongodb_db_name],
        document_models=[
            # Core
            User, Session,
            # Trading
            TradingAccount, Trade, Instrument,
            # Finance
            Wallet, Transaction,
            # Charges
            ChargeSettings,
            # Prop
            PropAccount, PropSettings, PropChallenge,
            # Business
            IBAccount, IBTree, IBCommission, IBLevelSettings,
            # Social
            CopyMaster, CopySubscription, CopySignal, PAMMAccount,
            # Bots
            Bot, BotSignal,
            # Challenges
            Challenge, ChallengeEntry,
            # KYC
            KYCDocument,
            # Admin
            AdminAuditLog, SubAdminPermissions, AccountTypeSettings, PlatformSettings,
            # Notifications
            Notification, AdminNotification,
            # Banking
            BankingDetail,
            # Platform-wide payment settings
            PlatformPaymentSettings,
            # Signup requests
            SignupRequest,
        ],
    )

    await _ensure_indexes()


async def _ensure_indexes():
    """Create database indexes for performance and uniqueness."""
    # User indexes
    await User.get_motor_collection().create_index("email", unique=True, background=True)

    # Session indexes
    session_col = Session.get_motor_collection()
    await session_col.create_index("user_id", background=True)
    await session_col.create_index("is_active", background=True)
    await session_col.create_index("created_at", expireAfterSeconds=60 * 60 * 24 * 30, background=True)

    # Account indexes
    acct_col = TradingAccount.get_motor_collection()
    await acct_col.create_index("user_id", background=True)
    await acct_col.create_index("account_number", unique=True, background=True)

    # Wallet index
    await Wallet.get_motor_collection().create_index("user_id", unique=True, background=True)

    # Trade indexes
    trade_col = Trade.get_motor_collection()
    await trade_col.create_index("account_id", background=True)
    await trade_col.create_index("user_id", background=True)
    await trade_col.create_index("status", background=True)
    await trade_col.create_index([("user_id", 1), ("status", 1)], background=True)

    # Transaction indexes
    txn_col = Transaction.get_motor_collection()
    await txn_col.create_index("user_id", background=True)
    await txn_col.create_index("status", background=True)
    await txn_col.create_index("created_at", background=True)

    # Instrument index
    await Instrument.get_motor_collection().create_index("symbol", unique=True, background=True)

    # IB indexes
    await IBAccount.get_motor_collection().create_index("user_id", background=True)
    await IBTree.get_motor_collection().create_index("user_id", unique=True, background=True)
    await IBCommission.get_motor_collection().create_index("ib_id", background=True)

    # Prop indexes
    await PropAccount.get_motor_collection().create_index("user_id", background=True)
    await PropAccount.get_motor_collection().create_index("status", background=True)
    await PropAccount.get_motor_collection().create_index(
        [("user_id", 1), ("status", 1)], background=True
    )
    await PropChallenge.get_motor_collection().create_index(
        [("admin_id", 1), ("is_active", 1), ("sort_order", 1)], background=True
    )
    await PropSettings.get_motor_collection().create_index("admin_id", background=True)

    # Bot indexes
    await Bot.get_motor_collection().create_index("user_id", background=True)
    await Bot.get_motor_collection().create_index("webhook_secret", unique=True, background=True)

    # Challenge indexes
    await ChallengeEntry.get_motor_collection().create_index(
        [("challenge_id", 1), ("user_id", 1)], unique=True, background=True
    )

    # KYC indexes
    await KYCDocument.get_motor_collection().create_index("user_id", background=True)

    # Signup request indexes
    sr_col = SignupRequest.get_motor_collection()
    await sr_col.create_index("email", background=True)
    await sr_col.create_index("status", background=True)

    # Charge indexes
    await ChargeSettings.get_motor_collection().create_index(
        [("level", 1), ("target_id", 1), ("instrument_id", 1)], background=True
    )


async def close_db():
    """Close MongoDB connection on shutdown."""
    global _client
    if _client:
        _client.close()
        _client = None
