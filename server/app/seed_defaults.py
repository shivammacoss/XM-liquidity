"""
XMLiquidity — Seed Default Settings
Account type defaults + default charge settings.
"""

from app.models.admin import AccountTypeSettings
from app.models.charge import ChargeSettings, ChargeLevel


async def seed_account_types():
    """Seed default account type settings if none exist."""
    count = await AccountTypeSettings.count()
    if count > 0:
        return

    defaults = [
        {"account_type": "ecn", "display_name": "ECN", "description": "Ultra-tight spreads, direct market access", "min_deposit": 100, "default_leverage": 200, "max_leverage": 500, "swap_enabled": True, "sort_order": 1},
        {"account_type": "standard", "display_name": "Standard", "description": "Best for beginners, balanced conditions", "min_deposit": 25, "default_leverage": 100, "max_leverage": 500, "swap_enabled": True, "sort_order": 2},
        {"account_type": "raw", "display_name": "Raw", "description": "Zero markup, commission-based", "min_deposit": 200, "default_leverage": 200, "max_leverage": 500, "swap_enabled": True, "sort_order": 3},
        {"account_type": "elite", "display_name": "Elite", "description": "Premium features, lowest charges (KYC required)", "min_deposit": 500, "default_leverage": 300, "max_leverage": 500, "swap_enabled": True, "sort_order": 4},
        {"account_type": "islamic", "display_name": "Islamic", "description": "Swap-free, Shariah compliant", "min_deposit": 25, "default_leverage": 100, "max_leverage": 500, "swap_enabled": False, "sort_order": 5},
        {"account_type": "cent", "display_name": "Cent", "description": "Micro lots, perfect for practice", "min_deposit": 5, "default_leverage": 100, "max_leverage": 200, "swap_enabled": True, "sort_order": 6},
    ]

    for d in defaults:
        await AccountTypeSettings(**d).insert()

    print(f"[SEED] Inserted {len(defaults)} account type settings.")


async def seed_default_charges():
    """Seed default charge settings for each account type if none exist."""
    count = await ChargeSettings.count()
    if count > 0:
        return

    account_charges = [
        {"target_id": "ecn", "spread_markup": 0.3, "commission_per_lot": 3.0, "swap_long": -2.5, "swap_short": -1.5},
        {"target_id": "standard", "spread_markup": 1.2, "commission_per_lot": 0.0, "swap_long": -3.0, "swap_short": -2.0},
        {"target_id": "raw", "spread_markup": 0.0, "commission_per_lot": 3.5, "swap_long": -2.5, "swap_short": -1.5},
        {"target_id": "elite", "spread_markup": 0.1, "commission_per_lot": 2.0, "swap_long": -1.5, "swap_short": -1.0},
        {"target_id": "islamic", "spread_markup": 1.5, "commission_per_lot": 0.0, "swap_long": 0.0, "swap_short": 0.0},
        {"target_id": "cent", "spread_markup": 2.0, "commission_per_lot": 0.0, "swap_long": -3.5, "swap_short": -2.5},
    ]

    for ac in account_charges:
        charge = ChargeSettings(
            level=ChargeLevel.ACCOUNT_TYPE,
            target_id=ac["target_id"],
            spread_markup=ac["spread_markup"],
            commission_per_lot=ac["commission_per_lot"],
            swap_long=ac["swap_long"],
            swap_short=ac["swap_short"],
            priority=10,
        )
        await charge.insert()

    print(f"[SEED] Inserted {len(account_charges)} default charge settings.")
