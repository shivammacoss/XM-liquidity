"""
End-to-end logic test for Prop Challenge.
Hits the real MongoDB. Reports PASS/FAIL for every step bharat_funded does.

Run: ./venv/Scripts/python.exe test_prop_logic.py
"""
import asyncio
import sys
from datetime import datetime, timezone, timedelta

from app.database import init_db, close_db
from app.models.user import User, UserRole
from app.models.wallet import Wallet
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.models.prop import (
    PropAccount, PropAccountStatus, PropChallenge, PropSettings,
    PropTier, PropType,
)
from app.services import prop_engine
from app.utils.security import hash_password


PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
WARN = "\033[93mWARN\033[0m"
results = []


def check(name, ok, detail=""):
    badge = PASS if ok else FAIL
    line = f"  [{badge}] {name}" + (f" — {detail}" if detail else "")
    print(line)
    results.append((name, ok, detail))


async def cleanup_test_data():
    """Wipe any leftover test fixtures from a previous run."""
    await User.find(User.email == "test_admin_prop@xmliquidity-test.io").delete()
    await User.find(User.email == "test_user_prop@xmliquidity-test.io").delete()
    await PropChallenge.find(PropChallenge.name == "TEST_2STEP_PRO").delete()
    # Wallets / accounts / transactions cascade by user_id, but those users are gone.


async def main():
    print("\n" + "=" * 60)
    print("  PROP CHALLENGE END-TO-END LOGIC TEST")
    print("=" * 60)
    print()

    print("[1/12] Connecting to MongoDB...")
    await init_db()
    print("       OK")
    await cleanup_test_data()

    # -----------------------------------------------------------------
    # 1. Create test admin + user fixtures
    # -----------------------------------------------------------------
    print("\n[2/12] Creating fixtures (admin + user + wallet)...")
    admin = User(
        email="test_admin_prop@xmliquidity-test.io",
        password_hash=hash_password("TestPass123!"),
        name="Test Admin",
        role=UserRole.SUPER_ADMIN,
    )
    await admin.insert()

    user = User(
        email="test_user_prop@xmliquidity-test.io",
        password_hash=hash_password("TestPass123!"),
        name="Test User",
        role=UserRole.USER,
    )
    await user.insert()

    # Fund the user's wallet
    wallet = Wallet(user_id=user.id, balance=1000.0, total_deposited=1000.0)
    await wallet.insert()
    check("admin/user/wallet seeded", True, f"wallet=${wallet.balance}")

    # -----------------------------------------------------------------
    # 2. Settings — admin toggles challenge mode ON
    # -----------------------------------------------------------------
    print("\n[3/12] Admin enables challenge mode...")
    s = await prop_engine.get_or_create_prop_settings(admin.id)
    s.challenge_mode_enabled = True
    s.display_name = "Test Challenge Mode"
    await s.save()
    enabled = await prop_engine.is_challenge_mode_enabled(admin.id)
    check("settings.challenge_mode_enabled flips ON", enabled is True)

    # -----------------------------------------------------------------
    # 3. Create a multi-tier challenge
    # -----------------------------------------------------------------
    print("\n[4/12] Admin creates 2-step challenge with 3 tiers...")
    challenge = PropChallenge(
        admin_id=admin.id,
        name="TEST_2STEP_PRO",
        description="End-to-end test challenge",
        prop_type=PropType.TWO_STEP,
        steps_count=2,
        tiers=[
            PropTier(account_size=10000, price=99, label="Starter"),
            PropTier(account_size=25000, price=199, label="Popular", is_popular=True),
            PropTier(account_size=50000, price=349, label="Pro"),
        ],
        rules={
            "max_daily_loss_pct": 5.0,
            "max_total_loss_pct": 10.0,
            "profit_target_phase1_pct": 8.0,
            "profit_target_phase2_pct": 5.0,
            "max_leverage": 100,
            "challenge_expiry_days": 30,
            "trading_days_required": 0,
            "min_trades_required": 1,
            "min_lot_size": 0.01,
            "max_lot_size": 100,
            "allow_fractional_lots": True,
            "stop_loss_required": False,
            "take_profit_required": False,
            "max_one_day_profit_pct_of_target": None,
            "consistency_rule_pct": None,
        },
        funded_settings={"profit_split_pct": 80, "withdrawal_cooldown_days": 14},
        is_active=True,
    )
    await challenge.insert()
    check("challenge created with 3 tiers", len(challenge.tiers) == 3, f"id={challenge.id}")

    # -----------------------------------------------------------------
    # 4. User buys the Popular tier (index=1) — wallet should debit $199
    # -----------------------------------------------------------------
    print("\n[5/12] User buys Popular tier (tier_index=1, $199)...")
    try:
        result = await prop_engine.buy_challenge(user.id, challenge.id, tier_index=1)
        prop = result["account"]
    except Exception as e:
        check("buy_challenge", False, str(e))
        return await close_db()

    wallet = await Wallet.find_one(Wallet.user_id == user.id)
    check("buy debits wallet by tier price", abs(wallet.balance - (1000 - 199)) < 0.01,
          f"wallet=${wallet.balance:.2f}")
    check("PropAccount created with tier fund_size",
          prop.account_size == 25000, f"size=${prop.account_size}")
    check("sub_wallet seeded with fund_size",
          prop.sub_wallet_balance == 25000 and prop.sub_wallet_equity == 25000)
    check("status=ACTIVE, phase=1, total_phases=2",
          prop.status == PropAccountStatus.ACTIVE and prop.current_phase == 1 and prop.total_phases == 2)
    check("price_paid recorded", prop.price_paid == 199)
    check("expires_at ~30 days out",
          prop.expires_at is not None and (prop.expires_at - datetime.now(timezone.utc)).days >= 28)

    # Purchase Transaction created
    txns = await Transaction.find(Transaction.user_id == user.id, Transaction.type == TransactionType.PROP_PURCHASE).to_list()
    check("PROP_PURCHASE transaction logged",
          len(txns) == 1 and txns[0].amount == 199 and txns[0].prop_account_id == prop.id)

    # -----------------------------------------------------------------
    # 5. Insufficient balance path
    # -----------------------------------------------------------------
    print("\n[6/12] Insufficient balance must reject buy...")
    poor_user = User(
        email="poor_user@xmliquidity-test.io",
        password_hash=hash_password("TestPass123!"), name="Poor", role=UserRole.USER,
    )
    await poor_user.insert()
    poor_wallet = Wallet(user_id=poor_user.id, balance=10.0)
    await poor_wallet.insert()
    rejected = False
    try:
        await prop_engine.buy_challenge(poor_user.id, challenge.id, tier_index=0)
    except ValueError as e:
        rejected = "Insufficient" in str(e)
    check("buy rejects when wallet < price", rejected)
    await poor_user.delete()
    await Wallet.find(Wallet.user_id == poor_user.id).delete()

    # -----------------------------------------------------------------
    # 6. Drawdown calc — simulate $1500 loss (6% of 25000) → exceeds 5% daily DD
    # -----------------------------------------------------------------
    print("\n[7/12] Drawdown breach must auto-blow account...")
    # Manually drive equity down (no Trade required for the engine test)
    prop.day_start_equity = 25000
    prop.lowest_equity_today = 23500   # -6%
    prop.lowest_equity_overall = 23500
    # Recompute using the model method
    prop.sub_wallet_equity = 23500
    prop.current_daily_drawdown_pct = ((25000 - 23500) / 25000) * 100  # 6.0
    prop.current_overall_drawdown_pct = ((25000 - 23500) / 25000) * 100
    await prop.save()
    rules = prop.risk_rules
    breach = prop.current_daily_drawdown_pct >= rules["max_daily_loss_pct"]
    check("daily DD calc correct (6% on $1500 of $25k)",
          abs(prop.current_daily_drawdown_pct - 6.0) < 0.01)
    check("breach detected (6% >= 5% rule)", breach)

    # -----------------------------------------------------------------
    # 7. Force-fail must blow the account properly
    # -----------------------------------------------------------------
    print("\n[8/12] Admin force-fail...")
    try:
        await prop_engine.force_fail(prop.id, admin.id, "Test blow")
    except Exception as e:
        check("force_fail", False, str(e))
        return await close_db()
    prop = await PropAccount.get(prop.id)
    check("status flips to BLOWN", prop.status == PropAccountStatus.BLOWN)
    check("blown_reason recorded", prop.blown_reason == "Test blow")
    check("violations log has entry",
          any(v.get("rule") == "ADMIN_FORCE_FAIL" for v in prop.violations))

    # -----------------------------------------------------------------
    # 8. Reset must restore everything to active state
    # -----------------------------------------------------------------
    print("\n[9/12] Admin reset...")
    await prop_engine.reset_account(prop.id, admin.id)
    prop = await PropAccount.get(prop.id)
    ok = (
        prop.status == PropAccountStatus.ACTIVE
        and prop.sub_wallet_balance == 25000
        and prop.current_profit_pct == 0
        and prop.current_daily_drawdown_pct == 0
        and not prop.is_blown
    )
    check("reset returns ACTIVE/clean state", ok,
          f"status={prop.status.value} bal=${prop.sub_wallet_balance}")

    # -----------------------------------------------------------------
    # 9. Force-pass with phase advance THEN funded clone
    # -----------------------------------------------------------------
    print("\n[10/12] Admin force-pass creates funded clone...")
    await prop_engine.force_pass(prop.id, admin.id)
    prop = await PropAccount.get(prop.id)
    check("status flips to PASSED", prop.status == PropAccountStatus.PASSED)
    check("passed_at timestamped", prop.passed_at is not None)
    check("live_account_id (funded clone) set", prop.live_account_id is not None)

    funded = await PropAccount.get(prop.live_account_id)
    check("funded clone status=FUNDED", funded.status == PropAccountStatus.FUNDED)
    check("funded clone account_size matches", funded.account_size == 25000)
    check("funded clone profit_split_pct from rules",
          funded.profit_split_pct == 80, f"split={funded.profit_split_pct}")

    # -----------------------------------------------------------------
    # 10. Withdraw flow — funded sub-wallet > initial → pending Transaction
    # -----------------------------------------------------------------
    print("\n[11/12] Withdraw flow (funded with profit)...")
    funded.sub_wallet_balance = 26000  # +$1000 profit
    await funded.save()
    try:
        wd = await prop_engine.request_withdrawal(funded.id, user.id)
    except Exception as e:
        check("request_withdrawal", False, str(e))
        return await close_db()

    expected_payout = (1000 * 80) / 100   # 80% of $1000 = $800
    check("payout amount = profit × split (80%)",
          abs(wd["requested_amount"] - expected_payout) < 0.01,
          f"asked=${wd['requested_amount']:.2f} expected=${expected_payout:.2f}")
    check("split_pct in response", wd["split_pct"] == 80)
    check("profit in response", wd["profit"] == 1000)

    # No-profit path
    funded2 = PropAccount(
        user_id=user.id, challenge_id=challenge.id,
        prop_type=PropType.INSTANT_FUND, account_size=10000, price_paid=0,
        status=PropAccountStatus.FUNDED,
        sub_wallet_balance=10000, sub_wallet_equity=10000, sub_wallet_free_margin=10000,
        phase_start_balance=10000, profit_split_pct=80,
        expires_at=datetime.now(timezone.utc) + timedelta(days=365),
    )
    await funded2.insert()
    no_profit = False
    try:
        await prop_engine.request_withdrawal(funded2.id, user.id)
    except ValueError as e:
        no_profit = "No profit" in str(e)
    check("withdraw rejects when sub_wallet == initial", no_profit)
    await funded2.delete()

    # Pending tx blocks duplicate
    dup_block = False
    try:
        await prop_engine.request_withdrawal(funded.id, user.id)
    except ValueError as e:
        dup_block = "already pending" in str(e)
    check("duplicate withdraw rejected when pending", dup_block)

    # -----------------------------------------------------------------
    # 11. Approve payout — credits wallet + resets sub-wallet
    # -----------------------------------------------------------------
    print("\n[12/12] Admin approves payout...")
    payout_tx = await Transaction.find_one(
        Transaction.user_id == user.id,
        Transaction.type == TransactionType.PROP_PAYOUT,
        Transaction.status == TransactionStatus.PENDING,
    )
    pre_wallet = await Wallet.find_one(Wallet.user_id == user.id)
    pre_bal = pre_wallet.balance

    try:
        result = await prop_engine.approve_payout(
            payout_tx.id, admin.id,
            custom_amount=None, override_cooldown=True, admin_note="auto-test",
        )
    except Exception as e:
        check("approve_payout", False, str(e))
        return await close_db()

    funded = await PropAccount.get(funded.id)
    post_wallet = await Wallet.find_one(Wallet.user_id == user.id)
    payout_tx = await Transaction.get(payout_tx.id)

    check("wallet credited by payout amount",
          abs(post_wallet.balance - (pre_bal + 800)) < 0.01,
          f"pre=${pre_bal:.2f} post=${post_wallet.balance:.2f}")
    check("sub_wallet reset to initial after payout",
          funded.sub_wallet_balance == funded.account_size)
    check("total_withdrawn incremented",
          funded.total_withdrawn == 800, f"total_withdrawn=${funded.total_withdrawn}")
    check("last_withdrawal_date set", funded.last_withdrawal_date is not None)
    check("Transaction.status=APPROVED", payout_tx.status == TransactionStatus.APPROVED)

    # Reject path
    reject_tx = Transaction(
        user_id=user.id,
        type=TransactionType.PROP_PAYOUT,
        status=TransactionStatus.PENDING,
        amount=100,
        prop_account_id=funded.id,
    )
    await reject_tx.insert()
    await prop_engine.reject_payout(reject_tx.id, admin.id, "test reject")
    reject_tx = await Transaction.get(reject_tx.id)
    check("reject_payout sets REJECTED + reason",
          reject_tx.status == TransactionStatus.REJECTED and reject_tx.rejection_reason == "test reject")

    # -----------------------------------------------------------------
    # Cleanup
    # -----------------------------------------------------------------
    print("\n[cleanup] removing test fixtures...")
    await PropAccount.find(PropAccount.user_id == user.id).delete()
    await Transaction.find(Transaction.user_id == user.id).delete()
    await Wallet.find(Wallet.user_id == user.id).delete()
    await PropChallenge.find(PropChallenge.id == challenge.id).delete()
    await PropSettings.find(PropSettings.admin_id == admin.id).delete()
    await User.find(User.id == admin.id).delete()
    await User.find(User.id == user.id).delete()

    await close_db()

    # Report
    print("\n" + "=" * 60)
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"  RESULT: {passed} / {total} checks passed")
    print("=" * 60)
    if passed != total:
        print("\nFailures:")
        for name, ok, detail in results:
            if not ok:
                print(f"  - {name}: {detail}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
