"""
XMLiquidity — Account Schemas
Request/response validation for trading accounts and wallet.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class CreateAccountRequest(BaseModel):
    account_type: str = Field(..., pattern="^(ecn|standard|raw|elite|islamic|cent)$")
    leverage: int = Field(100, ge=1, le=500)
    currency: str = "USD"


class AccountResponse(BaseModel):
    id: str
    user_id: str
    account_type: str
    account_number: str
    balance: float
    equity: float
    margin_used: float
    free_margin: float
    leverage: int
    currency: str
    is_funded: bool
    status: str
    is_prop_account: bool
    total_trades: int
    total_pnl: float
    win_count: int
    loss_count: int
    win_rate: float
    created_at: str


class AccountListResponse(BaseModel):
    accounts: List[AccountResponse]
    total: int


# --- Wallet ---

class WalletResponse(BaseModel):
    id: str
    balance: float
    currency: str
    total_deposited: float
    total_withdrawn: float
    total_transferred: float


class DepositRequest(BaseModel):
    amount: float = Field(..., ge=5000, le=1000000)
    method: str = Field(..., pattern="^(crypto_btc|crypto_eth|crypto_usdt|bank_wire)$")
    network: Optional[str] = Field(None, pattern="^(trc20|bep20)$")
    crypto_txn_hash: Optional[str] = None
    memo_tag: Optional[str] = None
    from_address: Optional[str] = None
    proof_image_url: Optional[str] = None  # URL of uploaded screenshot


class WithdrawRequest(BaseModel):
    amount: float = Field(..., gt=0, le=1000000)
    method: str = Field(..., pattern="^(crypto_btc|crypto_eth|crypto_usdt|bank_wire)$")
    network: Optional[str] = Field(None, pattern="^(trc20|bep20)$")
    wallet_address: Optional[str] = None   # User's destination address (crypto)


class InternalTransferRequest(BaseModel):
    amount: float = Field(..., gt=0, le=1000000)
    direction: str = Field(..., pattern="^(wallet_to_account|account_to_wallet)$")
    account_id: str


class TransactionResponse(BaseModel):
    id: str
    type: str
    method: str
    status: str
    amount: float
    currency: str
    crypto_txn_hash: Optional[str] = None
    memo_tag: Optional[str] = None
    from_account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    payment_details: dict = {}
    admin_notes: Optional[str] = None
    created_at: str


class TransactionListResponse(BaseModel):
    transactions: List[TransactionResponse]
    total: int
    page: int
    per_page: int
