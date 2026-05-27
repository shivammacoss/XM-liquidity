"""
XMLiquidity — Charge Calculator
Priority-based charge system: User > Account Type > Default
Calculates spread, swap, and commission for every trade.
"""

from typing import Optional
from app.models.charge import ChargeSettings, ChargeLevel


async def get_charges(
    user_id: str,
    account_type: str,
    instrument_symbol: str,
    segment: Optional[str] = None,
) -> dict:
    """
    Calculate charges for a trade using priority system:
    1. User-specific override (priority 20) — if exists, use it
    2. Account-type setting (priority 10) — if exists, use it
    3. Default setting (priority 0) — fallback

    Returns: {spread_markup, swap_long, swap_short, commission_per_lot}
    """

    defaults = {
        "spread_markup": 0.0,
        "swap_long": 0.0,
        "swap_short": 0.0,
        "commission_per_lot": 0.0,
    }

    # 1. Check user-specific override
    user_charge = await ChargeSettings.find_one(
        ChargeSettings.level == ChargeLevel.USER,
        ChargeSettings.target_id == user_id,
        ChargeSettings.instrument_id == instrument_symbol,
        ChargeSettings.is_active == True,
    )
    if user_charge:
        return {
            "spread_markup": user_charge.spread_markup,
            "swap_long": user_charge.swap_long,
            "swap_short": user_charge.swap_short,
            "commission_per_lot": user_charge.commission_per_lot,
        }

    # 2. Check account-type setting
    acct_charge = await ChargeSettings.find_one(
        ChargeSettings.level == ChargeLevel.ACCOUNT_TYPE,
        ChargeSettings.target_id == account_type,
        ChargeSettings.instrument_id == instrument_symbol,
        ChargeSettings.is_active == True,
    )
    if acct_charge:
        return {
            "spread_markup": acct_charge.spread_markup,
            "swap_long": acct_charge.swap_long,
            "swap_short": acct_charge.swap_short,
            "commission_per_lot": acct_charge.commission_per_lot,
        }

    # 2b. Check account-type for ALL instruments
    acct_charge_all = await ChargeSettings.find_one(
        ChargeSettings.level == ChargeLevel.ACCOUNT_TYPE,
        ChargeSettings.target_id == account_type,
        ChargeSettings.instrument_id == None,
        ChargeSettings.is_active == True,
    )
    if acct_charge_all:
        return {
            "spread_markup": acct_charge_all.spread_markup,
            "swap_long": acct_charge_all.swap_long,
            "swap_short": acct_charge_all.swap_short,
            "commission_per_lot": acct_charge_all.commission_per_lot,
        }

    # 3. Check default for this instrument
    default_charge = await ChargeSettings.find_one(
        ChargeSettings.level == ChargeLevel.DEFAULT,
        ChargeSettings.instrument_id == instrument_symbol,
        ChargeSettings.is_active == True,
    )
    if default_charge:
        return {
            "spread_markup": default_charge.spread_markup,
            "swap_long": default_charge.swap_long,
            "swap_short": default_charge.swap_short,
            "commission_per_lot": default_charge.commission_per_lot,
        }

    # 3b. Check default for segment
    if segment:
        segment_charge = await ChargeSettings.find_one(
            ChargeSettings.level == ChargeLevel.DEFAULT,
            ChargeSettings.segment == segment,
            ChargeSettings.is_active == True,
        )
        if segment_charge:
            return {
                "spread_markup": segment_charge.spread_markup,
                "swap_long": segment_charge.swap_long,
                "swap_short": segment_charge.swap_short,
                "commission_per_lot": segment_charge.commission_per_lot,
            }

    # 4. No charges set — return zeros
    return defaults
