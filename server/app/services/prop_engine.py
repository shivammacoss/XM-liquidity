"""
XMLiquidity — Prop Challenge Engine
Real-time rule enforcement + admin force-actions + payout queue + insights.

Brought to bharat_funded parity:
- Per-admin PropSettings resolver (settings.challenge_mode_enabled toggle)
- Multi-tier buy with tier_index
- Force pass / force fail / extend time / reset
- Withdraw → pending Transaction; admin approve credits Wallet, resets sub-wallet
- Dashboard + insights endpoints (equity curve, daily breakdown, win-rate,
  profit factor, expectancy, Sharpe, RRR, consistency, objectives table)
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
import math

from beanie import PydanticObjectId
from app.models.prop import (
    PropAccount, PropAccountStatus, PhaseStatus,
    PropChallenge, PropSettings, PropType,
)
from app.models.trade import Trade, TradeStatus, TradeDirection
from app.models.account import TradingAccount, AccountStatus, generate_account_number
from app.models.user import User
from app.models.wallet import Wallet
from app.models.transaction import Transaction, TransactionType, TransactionMethod, TransactionStatus


# ==========================================================================
# SETTINGS RESOLUTION
# ==========================================================================

async def get_or_create_prop_settings(admin_id: Optional[PydanticObjectId]) -> PropSettings:
    """Return per-admin PropSettings, falling back to a global (admin_id=None) row."""
    if admin_id:
        s = await PropSettings.find_one(PropSettings.admin_id == admin_id)
        if s:
            return s
        global_s = await PropSettings.find_one(PropSettings.admin_id == None)  # noqa: E711
        s = PropSettings(
            admin_id=admin_id,
            challenge_mode_enabled=global_s.challenge_mode_enabled if global_s else False,
            display_name=global_s.display_name if global_s else "Prop Trading Challenge",
            description=global_s.description if global_s else "Trade with our capital. Pass the challenge and get funded.",
            terms_and_conditions=global_s.terms_and_conditions if global_s else "",
        )
        await s.insert()
        return s

    s = await PropSettings.find_one(PropSettings.admin_id == None)  # noqa: E711
    if s:
        return s
    s = PropSettings()
    await s.insert()
    return s


async def is_challenge_mode_enabled(admin_id: Optional[PydanticObjectId] = None) -> bool:
    """If admin opted in OR there exists at least one active challenge, mode is on."""
    settings = await get_or_create_prop_settings(admin_id)
    if settings.challenge_mode_enabled:
        return True
    # Auto-enable when there are active challenges (matches bharat_funded /status)
    active_count = await PropChallenge.find(PropChallenge.is_active == True).count()
    return active_count > 0


# ==========================================================================
# CHALLENGE LIFECYCLE — BUY, EXPIRE, RESET
# ==========================================================================

def _compute_expires_at(challenge: PropChallenge) -> datetime:
    """Instant fund without expiry → 50yr; otherwise rules.challenge_expiry_days."""
    days = challenge.rules.get("challenge_expiry_days") if challenge.rules else None
    if challenge.steps_count == 0 and not days:
        return datetime.now(timezone.utc) + timedelta(days=365 * 50)
    n = int(days) if (days is not None and str(days).strip() != "") else 30
    if n <= 0:
        n = 30
    return datetime.now(timezone.utc) + timedelta(days=n)


def _resolve_tier(challenge: PropChallenge, tier_index: Optional[int]) -> Tuple[float, float]:
    """Pick (account_size, price) from tiers if present, else legacy single-tier."""
    if challenge.tiers:
        idx = tier_index if (isinstance(tier_index, int) and tier_index >= 0) else 0
        if idx >= len(challenge.tiers):
            raise ValueError("Invalid tier selection")
        t = challenge.tiers[idx]
        return float(t.account_size), float(t.price)
    return float(challenge.account_size or 0), float(challenge.price or 0)


def _phase_type_to_steps(prop_type: PropType, steps_count: int) -> int:
    """Authoritative steps. Honour explicit steps_count if set."""
    if steps_count in (0, 1, 2):
        return steps_count
    return {PropType.INSTANT_FUND: 0, PropType.ONE_STEP: 1, PropType.TWO_STEP: 2}.get(prop_type, 2)


async def buy_challenge(
    user_id: PydanticObjectId,
    challenge_id: PydanticObjectId,
    tier_index: Optional[int] = None,
) -> dict:
    """User buys a challenge — debit Wallet, create PropAccount with isolated sub-wallet."""
    challenge = await PropChallenge.get(challenge_id)
    if not challenge or not challenge.is_active:
        raise ValueError("Challenge not found or inactive")

    enabled = await is_challenge_mode_enabled(challenge.admin_id)
    if not enabled:
        raise ValueError("Challenge mode is currently disabled")

    fund_size, fee = _resolve_tier(challenge, tier_index)
    if fund_size <= 0 or fee < 0:
        raise ValueError("Challenge pricing is misconfigured")

    user = await User.get(user_id)
    if not user:
        raise ValueError("User not found")

    wallet = await Wallet.find_one(Wallet.user_id == user_id)
    bal = wallet.balance if wallet else 0
    if bal < fee:
        raise ValueError(f"Insufficient wallet balance. Need {fee}, available {bal:.2f}")

    if wallet:
        wallet.balance -= fee
        wallet.updated_at = datetime.now(timezone.utc)
        await wallet.save()

    # Record purchase transaction
    txn = Transaction(
        user_id=user_id,
        type=TransactionType.PROP_PURCHASE,
        method=TransactionMethod.INTERNAL,
        status=TransactionStatus.COMPLETED,
        amount=fee,
        payment_details={
            "challenge_id": str(challenge.id),
            "tier_index": tier_index,
            "kind": "prop_purchase",
        },
    )
    await txn.insert()

    steps = _phase_type_to_steps(challenge.prop_type, challenge.steps_count)
    has_instant_target = (
        steps == 0
        and float(challenge.rules.get("profit_target_instant_pct") or 0) > 0
    )
    initial_status = (
        PropAccountStatus.FUNDED
        if (steps == 0 and not has_instant_target)
        else PropAccountStatus.ACTIVE
    )

    expires_at = _compute_expires_at(challenge)
    rules_snapshot = dict(challenge.rules or {})
    profit_split = float((challenge.funded_settings or {}).get("profit_split_pct", 80.0))

    prop = PropAccount(
        user_id=user_id,
        challenge_id=challenge.id,
        prop_type=challenge.prop_type,
        account_size=fund_size,
        price_paid=fee,
        currency=challenge.currency or "USD",
        status=initial_status,
        current_phase=0 if steps == 0 else 1,
        total_phases=steps,
        risk_rules=rules_snapshot,
        sub_wallet_balance=fund_size,
        sub_wallet_equity=fund_size,
        sub_wallet_free_margin=fund_size,
        phase_start_balance=fund_size,
        day_start_equity=fund_size,
        lowest_equity_today=fund_size,
        lowest_equity_overall=fund_size,
        highest_equity=fund_size,
        profit_split_pct=profit_split,
        expires_at=expires_at,
        phases=[{
            "phase_num": 1 if steps > 0 else 0,
            "status": "active",
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": None,
            "starting_balance": fund_size,
            "current_balance": fund_size,
        }],
    )
    await prop.insert()

    txn.prop_account_id = prop.id
    await txn.save()

    return {"account": prop, "challenge": challenge}


# ==========================================================================
# RULE-CHECKING ENGINE  (kept from existing code, with extended hooks)
# ==========================================================================

async def check_prop_rules(
    prop_account_id: PydanticObjectId,
    event_type: str,  # "trade_open" | "trade_close" | "price_update"
    trade: Optional[Trade] = None,
):
    """Run on every trade event. Violations IMMEDIATELY blow the account."""
    prop = await PropAccount.get(prop_account_id)
    if not prop or prop.status != PropAccountStatus.ACTIVE:
        return

    rules = prop.risk_rules or {}
    account = await TradingAccount.get(prop.trading_account_id) if prop.trading_account_id else None
    if not account:
        return

    if event_type == "trade_open" and trade:
        if rules.get("stop_loss_required") and not trade.stop_loss:
            await _blow_account(prop, account, "Stop loss not set on trade (SL required)")
            return
        if rules.get("take_profit_required") and not trade.take_profit:
            await _blow_account(prop, account, "Take profit not set on trade (TP required)")
            return

    if trade and rules.get("max_lot_size", 0) > 0:
        if trade.lot_size > rules["max_lot_size"]:
            await _blow_account(prop, account, f"Lot size {trade.lot_size} exceeds max {rules['max_lot_size']}")
            return

    if event_type == "trade_open" and rules.get("max_concurrent_trades", 0):
        open_count = await Trade.find(
            Trade.account_id == account.id,
            Trade.status == TradeStatus.OPEN,
        ).count()
        if open_count > rules["max_concurrent_trades"]:
            await _blow_account(prop, account, f"Exceeded max open trades ({rules['max_concurrent_trades']})")
            return

    if event_type == "trade_open" and rules.get("max_trades_per_day", 0):
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_trades = await Trade.find(
            Trade.account_id == account.id,
            Trade.open_time >= today_start,
        ).count()
        if today_trades > rules["max_trades_per_day"]:
            await _blow_account(prop, account, f"Daily trade limit exceeded ({rules['max_trades_per_day']})")
            return

    if rules.get("max_daily_loss_pct", 0) > 0:
        daily_pnl = await _get_daily_pnl(account.id)
        max_daily_loss = prop.account_size * (rules["max_daily_loss_pct"] / 100)
        if daily_pnl <= -max_daily_loss:
            await _blow_account(prop, account, f"Daily loss limit exceeded ({abs(daily_pnl):.2f} > {max_daily_loss:.2f})")
            return

    if rules.get("max_total_loss_pct", 0) > 0:
        max_loss = prop.account_size * (rules["max_total_loss_pct"] / 100)
        total_loss = prop.account_size - account.equity
        if total_loss >= max_loss:
            await _blow_account(prop, account, f"Total loss limit exceeded (equity {account.equity:.2f})")
            return

    if trade and rules.get("max_leverage", 0) > 0:
        if account.leverage > rules["max_leverage"]:
            await _blow_account(prop, account, f"Leverage {account.leverage} exceeds max {rules['max_leverage']}")
            return

    target_pct = _get_target_pct(prop, rules)
    if target_pct > 0:
        profit = account.equity - prop.account_size
        target = prop.account_size * (target_pct / 100)
        if profit >= target:
            min_days = rules.get("trading_days_required") or 0
            if min_days > 0:
                days_traded = await _count_trading_days(account.id, prop.purchased_at)
                if days_traded < min_days:
                    return
            await _pass_phase(prop, account)
            return


def _get_target_pct(prop: PropAccount, rules: dict) -> float:
    if prop.total_phases == 0:
        return float(rules.get("profit_target_instant_pct") or 0)
    if prop.current_phase == 1:
        return float(rules.get("profit_target_phase1_pct") or rules.get("profit_target_pct") or 0)
    if prop.current_phase == 2:
        return float(rules.get("profit_target_phase2_pct") or 0)
    return 0.0


async def _get_daily_pnl(account_id: PydanticObjectId) -> float:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    closed_today = await Trade.find(
        Trade.account_id == account_id,
        Trade.status == TradeStatus.CLOSED,
        Trade.close_time >= today_start,
    ).to_list()
    realized = sum(t.pnl for t in closed_today)

    open_trades = await Trade.find(
        Trade.account_id == account_id,
        Trade.status == TradeStatus.OPEN,
    ).to_list()
    unrealized = 0.0
    for t in open_trades:
        if t.direction == TradeDirection.BUY:
            unrealized += (t.current_price - t.open_price) * t.lot_size * 100000
        else:
            unrealized += (t.open_price - t.current_price) * t.lot_size * 100000
    return realized + unrealized


async def _count_trading_days(account_id: PydanticObjectId, since: datetime) -> int:
    trades = await Trade.find(
        Trade.account_id == account_id,
        Trade.open_time >= since,
    ).to_list()
    return len({t.open_time.date() for t in trades})


async def _blow_account(prop: PropAccount, account: TradingAccount, reason: str):
    open_trades = await Trade.find(
        Trade.account_id == account.id,
        Trade.status == TradeStatus.OPEN,
    ).to_list()
    for trade in open_trades:
        trade.status = TradeStatus.CLOSED
        trade.close_price = trade.current_price
        if trade.direction == TradeDirection.BUY:
            trade.pnl = (trade.current_price - trade.open_price) * trade.lot_size * 100000
        else:
            trade.pnl = (trade.open_price - trade.current_price) * trade.lot_size * 100000
        trade.close_time = datetime.now(timezone.utc)
        await trade.save()

    prop.is_blown = True
    prop.blown_reason = reason
    prop.blown_at = datetime.now(timezone.utc)
    prop.status = PropAccountStatus.BLOWN
    if prop.phases:
        prop.phases[-1]["status"] = "blown"
        prop.phases[-1]["end_date"] = datetime.now(timezone.utc).isoformat()
    prop.violations.append({
        "rule": "AUTO_BLOW",
        "description": reason,
        "severity": "fail",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    await prop.save()

    account.status = AccountStatus.SUSPENDED
    account.updated_at = datetime.now(timezone.utc)
    await account.save()
    print(f"[PROP BLOW] {account.account_number}: {reason}")


async def _pass_phase(prop: PropAccount, account: TradingAccount):
    if prop.phases:
        prop.phases[-1]["status"] = "passed"
        prop.phases[-1]["end_date"] = datetime.now(timezone.utc).isoformat()
        prop.phases[-1]["current_balance"] = account.equity

    if prop.current_phase >= prop.total_phases:
        prop.status = PropAccountStatus.FUNDED
        prop.passed_at = datetime.now(timezone.utc)

        live_account = TradingAccount(
            user_id=prop.user_id,
            account_type=account.account_type,
            balance=prop.account_size,
            equity=prop.account_size,
            free_margin=prop.account_size,
            leverage=account.leverage,
            is_funded=True,
            initial_deposit=prop.account_size,
            is_prop_account=True,
            prop_account_id=prop.id,
        )
        while await TradingAccount.find_one(TradingAccount.account_number == live_account.account_number):
            live_account.account_number = generate_account_number()
        await live_account.insert()

        prop.live_account_id = live_account.id
        await prop.save()
        print(f"[PROP FUNDED] live account {live_account.account_number}")
    else:
        prop.current_phase += 1
        new_account = TradingAccount(
            user_id=prop.user_id,
            account_type=account.account_type,
            balance=prop.account_size,
            equity=prop.account_size,
            free_margin=prop.account_size,
            leverage=account.leverage,
            is_funded=True,
            initial_deposit=prop.account_size,
            is_prop_account=True,
            prop_account_id=prop.id,
        )
        while await TradingAccount.find_one(TradingAccount.account_number == new_account.account_number):
            new_account.account_number = generate_account_number()
        await new_account.insert()

        prop.phases.append({
            "phase_num": prop.current_phase,
            "status": "active",
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": None,
            "starting_balance": prop.account_size,
            "current_balance": prop.account_size,
            "trading_account_id": str(new_account.id),
        })
        prop.trading_account_id = new_account.id
        prop.phase_start_balance = prop.account_size
        prop.current_profit_pct = 0.0
        prop.current_daily_drawdown_pct = 0.0
        prop.max_daily_drawdown_hit = 0.0
        await prop.save()
        print(f"[PROP PHASE] advanced to phase {prop.current_phase}")


# ==========================================================================
# ADMIN FORCE-ACTIONS
# ==========================================================================

async def force_pass(prop_id: PydanticObjectId, admin_id: PydanticObjectId) -> PropAccount:
    prop = await PropAccount.get(prop_id)
    if not prop:
        raise ValueError("Prop account not found")

    prop.status = PropAccountStatus.PASSED
    prop.passed_at = datetime.now(timezone.utc)
    prop.violations.append({
        "rule": "ADMIN_FORCE_PASS",
        "description": f"Forced pass by admin {admin_id}",
        "severity": "warning",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    if prop.phases:
        prop.phases[-1]["status"] = "passed"
        prop.phases[-1]["end_date"] = datetime.now(timezone.utc).isoformat()

    # Spin up funded clone
    challenge = await PropChallenge.get(prop.challenge_id) if prop.challenge_id else None
    fund_size = prop.account_size
    funded = PropAccount(
        user_id=prop.user_id,
        challenge_id=prop.challenge_id,
        prop_type=prop.prop_type,
        account_size=fund_size,
        price_paid=0.0,
        currency=prop.currency,
        status=PropAccountStatus.FUNDED,
        current_phase=0,
        total_phases=0,
        risk_rules=prop.risk_rules,
        sub_wallet_balance=fund_size,
        sub_wallet_equity=fund_size,
        sub_wallet_free_margin=fund_size,
        phase_start_balance=fund_size,
        day_start_equity=fund_size,
        lowest_equity_today=fund_size,
        lowest_equity_overall=fund_size,
        highest_equity=fund_size,
        profit_split_pct=(
            float((challenge.funded_settings or {}).get("profit_split_pct", 80.0))
            if challenge else prop.profit_split_pct
        ),
        expires_at=datetime.now(timezone.utc) + timedelta(days=365),
    )
    await funded.insert()
    prop.live_account_id = funded.id
    await prop.save()
    return prop


async def force_fail(prop_id: PydanticObjectId, admin_id: PydanticObjectId, reason: str = "") -> PropAccount:
    prop = await PropAccount.get(prop_id)
    if not prop:
        raise ValueError("Prop account not found")

    prop.status = PropAccountStatus.BLOWN
    prop.is_blown = True
    prop.blown_at = datetime.now(timezone.utc)
    prop.blown_reason = reason or "Admin force fail"
    prop.violations.append({
        "rule": "ADMIN_FORCE_FAIL",
        "description": prop.blown_reason,
        "severity": "fail",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    if prop.phases:
        prop.phases[-1]["status"] = "failed"
        prop.phases[-1]["end_date"] = datetime.now(timezone.utc).isoformat()
    await prop.save()
    return prop


async def extend_time(prop_id: PydanticObjectId, admin_id: PydanticObjectId, days: int) -> PropAccount:
    if days <= 0:
        raise ValueError("Days must be positive")
    prop = await PropAccount.get(prop_id)
    if not prop:
        raise ValueError("Prop account not found")
    base = prop.expires_at or datetime.now(timezone.utc)
    prop.expires_at = base + timedelta(days=days)
    prop.violations.append({
        "rule": "ADMIN_EXTEND_TIME",
        "description": f"Extended {days} days by admin {admin_id}",
        "severity": "warning",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    await prop.save()
    return prop


async def reset_account(prop_id: PydanticObjectId, admin_id: PydanticObjectId) -> PropAccount:
    prop = await PropAccount.get(prop_id)
    if not prop:
        raise ValueError("Prop account not found")
    challenge = await PropChallenge.get(prop.challenge_id) if prop.challenge_id else None
    expiry_days = (challenge.rules.get("challenge_expiry_days") if challenge and challenge.rules else 30) or 30
    if challenge and challenge.steps_count == 0 and not expiry_days:
        prop.expires_at = datetime.now(timezone.utc) + timedelta(days=365 * 50)
    else:
        n = int(expiry_days) if expiry_days else 30
        prop.expires_at = datetime.now(timezone.utc) + timedelta(days=max(n, 1))

    fund = prop.account_size
    prop.status = PropAccountStatus.ACTIVE
    prop.current_phase = 1 if prop.total_phases > 0 else 0
    prop.sub_wallet_balance = fund
    prop.sub_wallet_equity = fund
    prop.sub_wallet_margin = 0.0
    prop.sub_wallet_free_margin = fund
    prop.phase_start_balance = fund
    prop.day_start_equity = fund
    prop.lowest_equity_today = fund
    prop.lowest_equity_overall = fund
    prop.highest_equity = fund
    prop.current_daily_drawdown_pct = 0.0
    prop.current_overall_drawdown_pct = 0.0
    prop.max_daily_drawdown_hit = 0.0
    prop.max_overall_drawdown_hit = 0.0
    prop.current_profit_pct = 0.0
    prop.total_profit_loss = 0.0
    prop.trades_today = 0
    prop.open_trades_count = 0
    prop.total_trades = 0
    prop.trading_days_count = 0
    prop.warnings_count = 0
    prop.is_blown = False
    prop.blown_reason = None
    prop.blown_at = None
    prop.passed_at = None
    prop.unique_trading_days = []
    prop.daily_pnl_map = {}
    prop.violations = [{
        "rule": "ADMIN_RESET",
        "description": f"Account reset by admin {admin_id}",
        "severity": "warning",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }]
    await prop.save()
    return prop


# ==========================================================================
# WITHDRAWAL FLOW
# ==========================================================================

async def request_withdrawal(prop_id: PydanticObjectId, user_id: PydanticObjectId) -> dict:
    prop = await PropAccount.get(prop_id)
    if not prop:
        raise ValueError("Prop account not found")
    if prop.user_id != user_id:
        raise ValueError("Not your account")
    if prop.status != PropAccountStatus.FUNDED:
        raise ValueError("Only funded accounts can withdraw")

    challenge = await PropChallenge.get(prop.challenge_id) if prop.challenge_id else None
    cooldown = int(((challenge.funded_settings if challenge else {}) or {}).get("withdrawal_cooldown_days", 14))
    if cooldown > 0 and prop.last_withdrawal_date:
        elapsed_days = (datetime.now(timezone.utc) - prop.last_withdrawal_date).total_seconds() / 86400
        if elapsed_days < cooldown:
            remaining = math.ceil(cooldown - elapsed_days)
            raise ValueError(f"Can withdraw again in {remaining} day(s)")

    existing = await Transaction.find_one(
        Transaction.user_id == user_id,
        Transaction.type == TransactionType.PROP_PAYOUT,
        Transaction.status == TransactionStatus.PENDING,
        Transaction.prop_account_id == prop.id,
    )
    if existing:
        raise ValueError("A payout request is already pending for this account")

    balance_now = prop.sub_wallet_balance or 0.0
    profit = max(0.0, balance_now - prop.account_size)
    if profit <= 0:
        raise ValueError("No profit to withdraw")

    split = prop.profit_split_pct or 80.0
    withdrawable = (profit * split) / 100.0
    if withdrawable <= 0:
        raise ValueError("No withdrawable amount")

    tx = Transaction(
        user_id=user_id,
        type=TransactionType.PROP_PAYOUT,
        method=TransactionMethod.INTERNAL,
        status=TransactionStatus.PENDING,
        amount=withdrawable,
        currency=prop.currency or "USD",
        prop_account_id=prop.id,
        user_note=f"Prop profit payout · {split}% of {profit:.2f} profit · account {prop.id}",
        payment_details={
            "kind": "prop_payout",
            "challenge_account_id": str(prop.id),
            "profit": profit,
            "split_pct": split,
        },
    )
    await tx.insert()

    return {
        "transaction_id": str(tx.id),
        "requested_amount": withdrawable,
        "profit": profit,
        "split_pct": split,
    }


async def approve_payout(
    txn_id: PydanticObjectId,
    admin_id: PydanticObjectId,
    custom_amount: Optional[float] = None,
    override_cooldown: bool = False,
    admin_note: str = "",
) -> dict:
    tx = await Transaction.get(txn_id)
    if not tx:
        raise ValueError("Payout request not found")
    if tx.status != TransactionStatus.PENDING:
        raise ValueError(f"Request is {tx.status.value}")
    if tx.type != TransactionType.PROP_PAYOUT or not tx.prop_account_id:
        raise ValueError("Not a prop payout transaction")

    prop = await PropAccount.get(tx.prop_account_id)
    if not prop:
        raise ValueError("Prop account not found")

    challenge = await PropChallenge.get(prop.challenge_id) if prop.challenge_id else None
    cooldown_days = int(((challenge.funded_settings if challenge else {}) or {}).get("withdrawal_cooldown_days", 0))
    if not override_cooldown and cooldown_days > 0 and prop.last_withdrawal_date:
        elapsed = (datetime.now(timezone.utc) - prop.last_withdrawal_date).total_seconds() / 86400
        if elapsed < cooldown_days:
            remaining = math.ceil(cooldown_days - elapsed)
            raise ValueError(f"Cooldown not met ({remaining} more day(s)). Pass override_cooldown=true to bypass.")

    amount = float(custom_amount) if (custom_amount is not None and custom_amount > 0) else float(tx.amount)
    if amount <= 0:
        raise ValueError("Invalid payout amount")

    user = await User.get(tx.user_id)
    if not user:
        raise ValueError("User not found")
    wallet = await Wallet.find_one(Wallet.user_id == user.id)
    if not wallet:
        wallet = Wallet(user_id=user.id, balance=0.0)
        await wallet.insert()
    wallet.balance += amount
    wallet.total_deposited += amount
    wallet.updated_at = datetime.now(timezone.utc)
    await wallet.save()

    initial = prop.account_size
    prop.sub_wallet_balance = initial
    prop.sub_wallet_equity = initial
    prop.sub_wallet_margin = 0.0
    prop.sub_wallet_free_margin = initial
    prop.phase_start_balance = initial
    prop.total_withdrawn = (prop.total_withdrawn or 0) + amount
    prop.last_withdrawal_date = datetime.now(timezone.utc)
    await prop.save()

    tx.status = TransactionStatus.APPROVED
    tx.amount = amount
    tx.admin_notes = admin_note or ""
    tx.reviewed_by = admin_id
    tx.reviewed_at = datetime.now(timezone.utc)
    await tx.save()

    return {
        "amount": amount,
        "wallet_balance": wallet.balance,
        "transaction": tx,
    }


async def reject_payout(
    txn_id: PydanticObjectId,
    admin_id: PydanticObjectId,
    reason: str,
) -> Transaction:
    if not reason or not reason.strip():
        raise ValueError("Rejection reason is required")
    tx = await Transaction.get(txn_id)
    if not tx:
        raise ValueError("Payout request not found")
    if tx.status != TransactionStatus.PENDING:
        raise ValueError(f"Request is {tx.status.value}")
    tx.status = TransactionStatus.REJECTED
    tx.rejection_reason = reason.strip()
    tx.reviewed_by = admin_id
    tx.reviewed_at = datetime.now(timezone.utc)
    await tx.save()
    return tx


# ==========================================================================
# DASHBOARDS / INSIGHTS  (user-facing analytics)
# ==========================================================================

async def get_account_dashboard(prop_id: PydanticObjectId, user_id: Optional[PydanticObjectId] = None) -> Optional[dict]:
    prop = await PropAccount.get(prop_id)
    if not prop:
        return None
    if user_id and prop.user_id != user_id:
        return None
    rules = prop.risk_rules or {}
    target_pct = _get_target_pct(prop, rules)
    target_progress = (
        min(100.0, (max(0.0, prop.current_profit_pct) / target_pct) * 100.0)
        if target_pct > 0 else 0.0
    )
    remaining_days = 0
    if prop.expires_at:
        ms = (prop.expires_at - datetime.now(timezone.utc)).total_seconds()
        remaining_days = max(0, math.ceil(ms / 86400))

    withdrawable = 0.0
    if prop.status == PropAccountStatus.FUNDED:
        profit = max(0.0, (prop.sub_wallet_balance or 0) - prop.account_size)
        withdrawable = (profit * (prop.profit_split_pct or 80)) / 100

    return {
        "account": {
            "id": str(prop.id),
            "status": prop.status.value,
            "prop_type": prop.prop_type.value,
            "current_phase": prop.current_phase,
            "total_phases": prop.total_phases,
            "blown_reason": prop.blown_reason,
            "passed_at": prop.passed_at.isoformat() if prop.passed_at else None,
            "blown_at": prop.blown_at.isoformat() if prop.blown_at else None,
            "created_at": prop.created_at.isoformat(),
        },
        "balance": {
            "initial": prop.account_size,
            "current": prop.sub_wallet_balance or 0,
            "equity": prop.sub_wallet_equity or 0,
            "profit_loss": prop.total_profit_loss,
        },
        "drawdown": {
            "daily_used": prop.current_daily_drawdown_pct,
            "daily_max": rules.get("max_daily_loss_pct", 5),
            "daily_remaining": max(0.0, (rules.get("max_daily_loss_pct", 5) or 0) - (prop.current_daily_drawdown_pct or 0)),
            "overall_used": prop.current_overall_drawdown_pct,
            "overall_max": rules.get("max_total_loss_pct", 10),
            "overall_remaining": max(0.0, (rules.get("max_total_loss_pct", 10) or 0) - (prop.current_overall_drawdown_pct or 0)),
        },
        "profit": {
            "current_pct": prop.current_profit_pct,
            "target_pct": target_pct,
            "target_progress": target_progress,
            "amount_to_target": max(0.0, (target_pct / 100) * prop.phase_start_balance - prop.total_profit_loss) if target_pct > 0 else 0.0,
        },
        "trades": {
            "today": prop.trades_today,
            "max_per_day": rules.get("max_trades_per_day"),
            "open_count": prop.open_trades_count,
            "max_concurrent": rules.get("max_concurrent_trades"),
            "total": prop.total_trades,
            "trading_days": prop.trading_days_count,
            "required_days": rules.get("trading_days_required"),
        },
        "rules": {
            "stop_loss_required": rules.get("stop_loss_required", False),
            "min_hold_seconds": rules.get("min_trade_hold_seconds", 0),
            "max_leverage": rules.get("max_leverage", 100),
            "min_lot_size": rules.get("min_lot_size", 0.01),
            "max_lot_size": rules.get("max_lot_size", 100),
        },
        "time": {
            "expires_at": prop.expires_at.isoformat() if prop.expires_at else None,
            "remaining_days": remaining_days,
            "created_at": prop.created_at.isoformat(),
        },
        "funded": {
            "profit_split_pct": prop.profit_split_pct,
            "withdrawable": withdrawable,
            "total_withdrawn": prop.total_withdrawn or 0,
            "last_withdrawal_date": prop.last_withdrawal_date.isoformat() if prop.last_withdrawal_date else None,
        },
        "violations": prop.violations or [],
    }


async def get_account_insights(prop_id: PydanticObjectId, user_id: Optional[PydanticObjectId] = None) -> Optional[dict]:
    """Equity curve, daily breakdown, performance metrics, objectives table."""
    prop = await PropAccount.get(prop_id)
    if not prop:
        return None
    if user_id and prop.user_id != user_id:
        return None

    challenge = await PropChallenge.get(prop.challenge_id) if prop.challenge_id else None
    rules = prop.risk_rules or {}
    initial = prop.account_size or 0.0
    current_balance = prop.sub_wallet_balance or initial

    open_trades, closed_trades = [], []
    if prop.trading_account_id:
        open_trades = await Trade.find(
            Trade.account_id == prop.trading_account_id,
            Trade.status == TradeStatus.OPEN,
        ).sort("-open_time").to_list()
        closed_trades = await Trade.find(
            Trade.account_id == prop.trading_account_id,
            Trade.status == TradeStatus.CLOSED,
        ).sort("close_time").to_list()

    unrealized = sum(t.pnl for t in open_trades) if open_trades else 0.0
    current_equity = current_balance + unrealized

    # Equity curve
    equity_curve = [{"t": (prop.created_at or datetime.now(timezone.utc)).isoformat(), "equity": initial}]
    running = initial
    for p in closed_trades:
        running += float(p.pnl or 0)
        ts = p.close_time or datetime.now(timezone.utc)
        equity_curve.append({"t": ts.isoformat(), "equity": round(running, 2)})
    if not equity_curve or equity_curve[-1]["equity"] != round(current_equity, 2):
        equity_curve.append({"t": datetime.now(timezone.utc).isoformat(), "equity": round(current_equity, 2)})

    # Daily breakdown
    daily_map = {}
    for p in closed_trades:
        if not p.close_time:
            continue
        key = p.close_time.date().isoformat()
        d = daily_map.setdefault(key, {"date": key, "pnl": 0, "trades": 0, "wins": 0, "losses": 0, "volume": 0})
        pnl = float(p.pnl or 0)
        d["pnl"] += pnl
        d["trades"] += 1
        if pnl > 0: d["wins"] += 1
        elif pnl < 0: d["losses"] += 1
        d["volume"] += float(p.lot_size or 0)
    daily_breakdown = sorted(daily_map.values(), key=lambda x: x["date"])

    today_key = datetime.now(timezone.utc).date().isoformat()
    todays_closed = daily_map.get(today_key, {}).get("pnl", 0)
    todays_pnl = todays_closed + unrealized

    # Performance
    total_closed = len(closed_trades)
    wins = [p for p in closed_trades if (p.pnl or 0) > 0]
    losses = [p for p in closed_trades if (p.pnl or 0) < 0]
    gross_profit = sum(p.pnl for p in wins)
    gross_loss = abs(sum(p.pnl for p in losses))
    avg_win = gross_profit / len(wins) if wins else 0
    avg_loss = gross_loss / len(losses) if losses else 0
    win_rate = (len(wins) / total_closed * 100) if total_closed else 0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (999 if gross_profit > 0 else 0)
    expectancy = ((win_rate / 100) * avg_win - ((100 - win_rate) / 100) * avg_loss) if total_closed else 0

    avg_duration = 0
    if total_closed:
        total_ms = 0; counted = 0
        for p in closed_trades:
            if p.open_time and p.close_time:
                total_ms += (p.close_time - p.open_time).total_seconds() * 1000
                counted += 1
        avg_duration = round(total_ms / counted / 1000) if counted else 0

    avg_rrr = 0
    rrrs = []
    for p in closed_trades:
        entry, sl, tp = p.open_price, p.stop_loss, p.take_profit
        if entry and sl and tp and entry > 0 and sl > 0 and tp > 0:
            risk = abs(entry - sl); reward = abs(tp - entry)
            if risk > 0:
                rrrs.append(reward / risk)
    if rrrs:
        avg_rrr = sum(rrrs) / len(rrrs)

    sharpe = 0
    if len(daily_breakdown) >= 2 and initial > 0:
        returns = [d["pnl"] / initial for d in daily_breakdown]
        mean = sum(returns) / len(returns)
        var = sum((x - mean) ** 2 for x in returns) / len(returns)
        std = math.sqrt(var)
        if std > 0:
            sharpe = (mean / std) * math.sqrt(252)

    # Consistency score
    consistency_score = None
    days_traded = len(daily_breakdown)
    total_profit = sum(max(0, d["pnl"]) for d in daily_breakdown)
    if total_profit > 0:
        best = max((d["pnl"] for d in daily_breakdown), default=0)
        ratio = best / total_profit
        consistency_score = max(0, min(100, round((1 - ratio) * 100)))

    # Objectives table
    daily_max = float(rules.get("max_daily_loss_pct", 5))
    overall_max = float(rules.get("max_total_loss_pct", 10))
    trading_days_required = int(rules.get("trading_days_required") or 0)
    target_pct = _get_target_pct(prop, rules)
    pct_amount = lambda pct: round((pct / 100) * initial, 2)

    objectives = []
    if trading_days_required > 0:
        objectives.append({
            "key": "trading-days",
            "label": f"Minimum {trading_days_required} Trading Day(s)",
            "target": trading_days_required,
            "actual": prop.trading_days_count,
            "unit": "days",
            "passed": prop.trading_days_count >= trading_days_required,
        })
    objectives.append({
        "key": "max-daily-loss",
        "label": f"Max Daily Loss −{pct_amount(daily_max)}",
        "target": daily_max,
        "actual": prop.current_daily_drawdown_pct,
        "unit": "%",
        "passed": (prop.current_daily_drawdown_pct or 0) < daily_max,
    })
    objectives.append({
        "key": "max-loss",
        "label": f"Max Loss −{pct_amount(overall_max)}",
        "target": overall_max,
        "actual": prop.current_overall_drawdown_pct,
        "unit": "%",
        "passed": (prop.current_overall_drawdown_pct or 0) < overall_max,
    })
    if prop.status != PropAccountStatus.FUNDED and target_pct > 0:
        objectives.append({
            "key": "profit-target",
            "label": f"Profit Target {pct_amount(target_pct)}",
            "target": target_pct,
            "actual": prop.current_profit_pct,
            "unit": "%",
            "passed": (prop.current_profit_pct or 0) >= target_pct,
        })

    max_one_day_cap = float(rules.get("max_one_day_profit_pct_of_target") or 0)
    if max_one_day_cap > 0 and target_pct > 0:
        max_day_abs = (max_one_day_cap / 100) * (target_pct / 100) * initial
        best_day = max(prop.daily_pnl_map.values(), default=0) if prop.daily_pnl_map else 0
        objectives.append({
            "key": "max-one-day-profit",
            "label": f"Max One-Day Profit {round(max_day_abs)}",
            "target": max_one_day_cap,
            "actual": round((best_day / max_day_abs) * 100, 1) if max_day_abs > 0 else 0,
            "unit": "% used",
            "passed": best_day <= max_day_abs,
        })

    consistency_limit = float(rules.get("consistency_rule_pct") or 0)
    if consistency_limit > 0:
        total_p = 0; best = 0
        for v in (prop.daily_pnl_map or {}).values():
            if v > 0:
                total_p += v
                if v > best: best = v
        ratio = (best / total_p * 100) if total_p > 0 else 0
        objectives.append({
            "key": "consistency",
            "label": f"Consistency (no day > {consistency_limit}% of total profit)",
            "target": consistency_limit,
            "actual": round(ratio, 1),
            "unit": "%",
            "passed": total_p <= 0 or ratio <= consistency_limit,
        })

    return {
        "overview": {
            "balance": round(current_balance, 2),
            "equity": round(current_equity, 2),
            "unrealized_pnl": round(unrealized, 2),
            "todays_pnl": round(todays_pnl, 2),
            "initial_balance": round(initial, 2),
            "total_pnl": round(current_equity - initial, 2),
            "total_pnl_pct": round(((current_equity - initial) / initial * 100), 2) if initial > 0 else 0,
        },
        "objectives": objectives,
        "stats": {
            "win_rate": round(win_rate, 2),
            "avg_profit": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "num_trades": total_closed,
            "avg_duration_sec": avg_duration,
            "sharpe": round(sharpe, 2),
            "avg_rrr": round(avg_rrr, 2),
            "profit_factor": round(profit_factor, 2) if profit_factor != 999 else 999,
            "expectancy": round(expectancy, 2),
        },
        "consistency": {
            "score": consistency_score,
            "days_traded": days_traded,
        },
        "equity_curve": equity_curve,
        "daily_breakdown": daily_breakdown,
        "open_trades": [
            {
                "id": str(t.id), "instrument": t.instrument, "direction": t.direction.value,
                "lot_size": t.lot_size, "open_price": t.open_price, "current_price": t.current_price,
                "pnl": round(t.pnl, 2), "open_time": t.open_time.isoformat(),
            } for t in open_trades
        ],
        "closed_trades": [
            {
                "id": str(t.id), "instrument": t.instrument, "direction": t.direction.value,
                "lot_size": t.lot_size, "open_price": t.open_price, "close_price": t.close_price,
                "pnl": round(t.pnl, 2),
                "open_time": t.open_time.isoformat(),
                "close_time": t.close_time.isoformat() if t.close_time else None,
            } for t in closed_trades[-100:][::-1]
        ],
        "meta": {
            "challenge_name": challenge.name if challenge else "Challenge",
            "fund_size": challenge.account_size if challenge else initial,
            "steps_count": challenge.steps_count if challenge else prop.total_phases,
            "currency": prop.currency,
            "status": prop.status.value,
            "phase": prop.current_phase,
            "total_phases": prop.total_phases,
            "created_at": prop.created_at.isoformat(),
            "expires_at": prop.expires_at.isoformat() if prop.expires_at else None,
        },
    }
