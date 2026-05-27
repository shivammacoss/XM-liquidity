"""
XMLiquidity — Seed Instruments
Populates the database with default tradeable instruments.
Run once on first setup, or call from startup.
"""

from app.models.instrument import Instrument, Segment


SEED_INSTRUMENTS = [
    # FOREX
    {"symbol": "EURUSD", "display_name": "EUR/USD", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "EURUSD", "trading_hours": "24/5"},
    {"symbol": "GBPUSD", "display_name": "GBP/USD", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "GBPUSD", "trading_hours": "24/5"},
    {"symbol": "USDJPY", "display_name": "USD/JPY", "segment": "forex", "pip_size": 0.01, "lot_size": 100000, "infoway_symbol": "USDJPY", "trading_hours": "24/5"},
    {"symbol": "AUDUSD", "display_name": "AUD/USD", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "AUDUSD", "trading_hours": "24/5"},
    {"symbol": "USDCAD", "display_name": "USD/CAD", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "USDCAD", "trading_hours": "24/5"},
    {"symbol": "NZDUSD", "display_name": "NZD/USD", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "NZDUSD", "trading_hours": "24/5"},
    {"symbol": "USDCHF", "display_name": "USD/CHF", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "USDCHF", "trading_hours": "24/5"},
    {"symbol": "EURGBP", "display_name": "EUR/GBP", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "EURGBP", "trading_hours": "24/5"},
    {"symbol": "EURJPY", "display_name": "EUR/JPY", "segment": "forex", "pip_size": 0.01, "lot_size": 100000, "infoway_symbol": "EURJPY", "trading_hours": "24/5"},
    {"symbol": "GBPJPY", "display_name": "GBP/JPY", "segment": "forex", "pip_size": 0.01, "lot_size": 100000, "infoway_symbol": "GBPJPY", "trading_hours": "24/5"},
    {"symbol": "AUDJPY", "display_name": "AUD/JPY", "segment": "forex", "pip_size": 0.01, "lot_size": 100000, "infoway_symbol": "AUDJPY", "trading_hours": "24/5"},
    {"symbol": "EURAUD", "display_name": "EUR/AUD", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "EURAUD", "trading_hours": "24/5"},
    {"symbol": "EURCHF", "display_name": "EUR/CHF", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "EURCHF", "trading_hours": "24/5"},
    {"symbol": "GBPCHF", "display_name": "GBP/CHF", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "GBPCHF", "trading_hours": "24/5"},
    {"symbol": "GBPAUD", "display_name": "GBP/AUD", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "GBPAUD", "trading_hours": "24/5"},
    {"symbol": "CADJPY", "display_name": "CAD/JPY", "segment": "forex", "pip_size": 0.01, "lot_size": 100000, "infoway_symbol": "CADJPY", "trading_hours": "24/5"},
    {"symbol": "CHFJPY", "display_name": "CHF/JPY", "segment": "forex", "pip_size": 0.01, "lot_size": 100000, "infoway_symbol": "CHFJPY", "trading_hours": "24/5"},
    {"symbol": "NZDJPY", "display_name": "NZD/JPY", "segment": "forex", "pip_size": 0.01, "lot_size": 100000, "infoway_symbol": "NZDJPY", "trading_hours": "24/5"},
    {"symbol": "EURNZD", "display_name": "EUR/NZD", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "EURNZD", "trading_hours": "24/5"},
    {"symbol": "EURCAD", "display_name": "EUR/CAD", "segment": "forex", "pip_size": 0.0001, "lot_size": 100000, "infoway_symbol": "EURCAD", "trading_hours": "24/5"},

    # METALS
    {"symbol": "XAUUSD", "display_name": "XAU/USD (Gold)", "segment": "metals", "pip_size": 0.01, "lot_size": 100, "min_lot": 0.01, "max_lot": 50, "infoway_symbol": "XAUUSD", "trading_hours": "24/5"},
    {"symbol": "XAGUSD", "display_name": "XAG/USD (Silver)", "segment": "metals", "pip_size": 0.001, "lot_size": 5000, "min_lot": 0.01, "max_lot": 50, "infoway_symbol": "XAGUSD", "trading_hours": "24/5"},

    # CRYPTO
    {"symbol": "BTCUSD", "display_name": "BTC/USD", "segment": "crypto", "pip_size": 0.01, "lot_size": 1, "min_lot": 0.001, "max_lot": 10, "infoway_symbol": "BTCUSDT", "trading_hours": "24/7"},
    {"symbol": "ETHUSD", "display_name": "ETH/USD", "segment": "crypto", "pip_size": 0.01, "lot_size": 1, "min_lot": 0.01, "max_lot": 100, "infoway_symbol": "ETHUSDT", "trading_hours": "24/7"},
    {"symbol": "XRPUSD", "display_name": "XRP/USD", "segment": "crypto", "pip_size": 0.0001, "lot_size": 1, "min_lot": 1, "max_lot": 100000, "infoway_symbol": "XRPUSDT", "trading_hours": "24/7"},
    {"symbol": "SOLUSD", "display_name": "SOL/USD", "segment": "crypto", "pip_size": 0.01, "lot_size": 1, "min_lot": 0.1, "max_lot": 1000, "infoway_symbol": "SOLUSDT", "trading_hours": "24/7"},
    {"symbol": "BNBUSD", "display_name": "BNB/USD", "segment": "crypto", "pip_size": 0.01, "lot_size": 1, "min_lot": 0.01, "max_lot": 500, "infoway_symbol": "BNBUSDT", "trading_hours": "24/7"},
    {"symbol": "ADAUSD", "display_name": "ADA/USD", "segment": "crypto", "pip_size": 0.0001, "lot_size": 1, "min_lot": 1, "max_lot": 100000, "infoway_symbol": "ADAUSDT", "trading_hours": "24/7"},
    {"symbol": "DOGEUSD", "display_name": "DOGE/USD", "segment": "crypto", "pip_size": 0.00001, "lot_size": 1, "min_lot": 10, "max_lot": 1000000, "infoway_symbol": "DOGEUSDT", "trading_hours": "24/7"},
    {"symbol": "LTCUSD", "display_name": "LTC/USD", "segment": "crypto", "pip_size": 0.01, "lot_size": 1, "min_lot": 0.1, "max_lot": 1000, "infoway_symbol": "LTCUSDT", "trading_hours": "24/7"},

    # INDICES
    {"symbol": "US30", "display_name": "US30 (Dow Jones)", "segment": "indices", "pip_size": 1, "lot_size": 1, "min_lot": 0.1, "max_lot": 100, "trading_hours": "24/5"},
    {"symbol": "US500", "display_name": "US500 (S&P 500)", "segment": "indices", "pip_size": 0.1, "lot_size": 1, "min_lot": 0.1, "max_lot": 100, "trading_hours": "24/5"},
    {"symbol": "USTEC", "display_name": "USTEC (Nasdaq)", "segment": "indices", "pip_size": 0.1, "lot_size": 1, "min_lot": 0.1, "max_lot": 100, "trading_hours": "24/5"},
    {"symbol": "UK100", "display_name": "UK100 (FTSE)", "segment": "indices", "pip_size": 0.1, "lot_size": 1, "min_lot": 0.1, "max_lot": 100, "trading_hours": "24/5"},
    {"symbol": "GER40", "display_name": "GER40 (DAX)", "segment": "indices", "pip_size": 0.1, "lot_size": 1, "min_lot": 0.1, "max_lot": 100, "trading_hours": "24/5"},

    # ENERGY
    {"symbol": "USOIL", "display_name": "US Oil (WTI)", "segment": "energy", "pip_size": 0.01, "lot_size": 1000, "min_lot": 0.01, "max_lot": 50, "trading_hours": "24/5"},
    {"symbol": "UKOIL", "display_name": "UK Oil (Brent)", "segment": "energy", "pip_size": 0.01, "lot_size": 1000, "min_lot": 0.01, "max_lot": 50, "trading_hours": "24/5"},
    {"symbol": "NGAS", "display_name": "Natural Gas", "segment": "energy", "pip_size": 0.001, "lot_size": 10000, "min_lot": 0.01, "max_lot": 50, "trading_hours": "24/5"},
]


async def seed_instruments():
    """Insert instruments if none exist."""
    count = await Instrument.count()
    if count > 0:
        print(f"[SEED] Instruments already seeded ({count} found). Skipping.")
        return

    inserted = 0
    for data in SEED_INSTRUMENTS:
        segment = Segment(data.pop("segment"))
        inst = Instrument(segment=segment, **data)
        try:
            await inst.insert()
            inserted += 1
        except Exception as e:
            print(f"[SEED] Failed to insert {data.get('symbol', '?')}: {e}")

    print(f"[SEED] Inserted {inserted} instruments.")
