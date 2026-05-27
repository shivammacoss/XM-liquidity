"""
XMLiquidity — IB Commission Distribution Engine
Direct IB: flat commission per trade.
Community IB: 10-level decreasing distribution.
Sub-Broker: % of all commissions (spread + swap + trade commission).
"""

from datetime import datetime, timezone
from typing import Optional, List

from beanie import PydanticObjectId
from app.models.ib import IBAccount, IBTree, IBCommission, IBLevelSettings, IBType
from app.models.trade import Trade
from app.models.wallet import Wallet


async def distribute_commissions(trade: Trade, total_spread: float, total_swap: float, total_commission: float):
    """
    Called after every trade close. Distributes commissions to all IBs in the chain.
    """
    # Find the trader's IB tree
    tree = await IBTree.find_one(IBTree.user_id == trade.user_id)
    if not tree or not tree.ancestors:
        return

    # Get level settings
    level_settings = await IBLevelSettings.find_one(IBLevelSettings.is_active == True)
    if not level_settings:
        return

    total_revenue = total_spread + total_swap + total_commission

    for depth, ancestor_id in enumerate(tree.ancestors, start=1):
        if depth > 10:
            break

        ib = await IBAccount.find_one(
            IBAccount.user_id == ancestor_id,
            IBAccount.is_active == True,
        )
        if not ib:
            continue

        commission_amount = 0.0

        if ib.ib_type == IBType.DIRECT:
            # Direct IB: flat rate per lot
            commission_amount = ib.commission_rate * trade.lot_size

        elif ib.ib_type == IBType.COMMUNITY:
            # Community IB: decreasing % per level
            level_pct = _get_level_pct(depth, level_settings)
            commission_amount = total_revenue * (level_pct / 100)

        elif ib.ib_type == IBType.SUB_BROKER:
            # Sub-Broker: % of ALL commissions
            commission_amount = total_revenue * (ib.business_share_rate / 100)

        if commission_amount <= 0:
            continue

        commission_amount = round(commission_amount, 4)

        # Record the commission
        record = IBCommission(
            ib_id=ib.id,
            source_trade_id=trade.id,
            source_user_id=trade.user_id,
            amount=commission_amount,
            revenue_type="combined",
            level=depth,
        )
        await record.insert()

        # Credit to IB's wallet
        wallet = await Wallet.find_one(Wallet.user_id == ib.user_id)
        if wallet:
            wallet.balance += commission_amount
            wallet.updated_at = datetime.now(timezone.utc)
            await wallet.save()

        # Update IB stats
        ib.total_earned += commission_amount
        ib.updated_at = datetime.now(timezone.utc)
        await ib.save()


def _get_level_pct(level: int, settings: IBLevelSettings) -> float:
    """Calculate commission % for a given level using decay formula or override."""
    # Check override first
    override_key = str(level)
    if settings.level_overrides and override_key in settings.level_overrides:
        return float(settings.level_overrides[override_key])

    # Decay formula: level_1 * (decay ^ (level - 1))
    return settings.level_1_pct * (settings.decay_factor ** (level - 1))


async def get_ib_dashboard(user_id: PydanticObjectId) -> dict:
    """Get IB dashboard data: levels, earnings, referrals."""
    ib = await IBAccount.find_one(IBAccount.user_id == user_id, IBAccount.is_active == True)
    if not ib:
        return {"has_ib": False}

    # Get referrals (users who have this IB in their tree)
    referrals = await IBTree.find(IBTree.ancestors == user_id).to_list()

    # Get commission history
    commissions = await IBCommission.find(
        IBCommission.ib_id == ib.id
    ).sort("-created_at").limit(50).to_list()

    # Get level distribution
    level_counts = {}
    for ref in referrals:
        idx = ref.ancestors.index(user_id) + 1 if user_id in ref.ancestors else 0
        level_counts[idx] = level_counts.get(idx, 0) + 1

    return {
        "has_ib": True,
        "ib_type": ib.ib_type.value,
        "referral_code": ib.referral_code,
        "total_earned": round(ib.total_earned, 2),
        "total_referrals": len(referrals),
        "level_distribution": level_counts,
        "recent_commissions": [
            {
                "id": str(c.id),
                "amount": round(c.amount, 4),
                "level": c.level,
                "revenue_type": c.revenue_type,
                "created_at": c.created_at.isoformat(),
            }
            for c in commissions
        ],
    }
