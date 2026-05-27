"""
XMLiquidity — Market Data Proxy
Proxies InfoWay API calls through our backend to avoid CORS issues.
Frontend calls our API → we call InfoWay with header auth → return data.

Handles mixed batches: splits crypto from non-crypto and merges results.
"""

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
import httpx

from app.config import settings

router = APIRouter(prefix="/market", tags=["Market Data"])

INFOWAY_REST = settings.infoway_rest_base
API_KEY = settings.infoway_api_key

HEADERS = {"apiKey": API_KEY, "Content-Type": "application/json"}

CRYPTO_SYMBOLS = {
    "BTCUSDT", "ETHUSDT", "XRPUSDT", "SOLUSDT", "BNBUSDT",
    "ADAUSDT", "DOGEUSDT", "LTCUSDT",
    "BTCUSD", "ETHUSD", "XRPUSD", "SOLUSD", "BNBUSD",
    "ADAUSD", "DOGEUSD", "LTCUSD",
}


def _is_crypto(symbol: str) -> bool:
    return symbol.upper().strip() in CRYPTO_SYMBOLS

def _to_infoway_crypto(symbol: str) -> str:
    """Convert BTCUSD → BTCUSDT for InfoWay crypto API."""
    s = symbol.upper().strip()
    if s.endswith("USD") and not s.endswith("USDT"):
        return s + "T"
    return s


@router.get("/symbols")
async def get_symbols(type: str = Query("FOREX")):
    """Proxy: GET symbol list from InfoWay."""
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            f"{INFOWAY_REST}/common/basic/symbols",
            params={"type": type},
            headers={"apiKey": API_KEY},
        )
        return JSONResponse(content=res.json(), status_code=res.status_code)


@router.post("/kline")
async def get_kline(request: Request):
    """Proxy: POST kline/candlestick data from InfoWay."""
    body = await request.json()
    codes = body.get("codes", "")

    # Determine endpoint and convert crypto symbols
    is_crypto = _is_crypto(codes)
    if is_crypto:
        codes = _to_infoway_crypto(codes)
        body = {**body, "codes": codes}
    endpoint = "/crypto/v2/batch_kline" if is_crypto else "/common/v2/batch_kline"

    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            f"{INFOWAY_REST}{endpoint}",
            json=body,
            headers=HEADERS,
        )
        return JSONResponse(content=res.json(), status_code=res.status_code)


@router.get("/trades/{codes}")
async def get_trades(codes: str):
    """
    Proxy: GET latest trade prices from InfoWay.
    Splits crypto and non-crypto symbols, calls both APIs, merges results.
    """
    all_symbols = [s.strip() for s in codes.split(",") if s.strip()]

    crypto_syms = [s for s in all_symbols if _is_crypto(s)]
    common_syms = [s for s in all_symbols if not _is_crypto(s)]

    all_data = []

    async with httpx.AsyncClient(timeout=10) as client:
        # Fetch non-crypto (forex, metals, indices, energy)
        if common_syms:
            common_codes = ",".join(common_syms)
            try:
                res = await client.get(
                    f"{INFOWAY_REST}/common/batch_trade/{common_codes}",
                    headers={"apiKey": API_KEY},
                )
                result = res.json()
                if result.get("ret") == 200 and result.get("data"):
                    all_data.extend(result["data"])
            except Exception as e:
                print(f"[Market Proxy] common trade error: {e}")

        # Fetch crypto (convert to USDT suffix for InfoWay)
        if crypto_syms:
            crypto_codes = ",".join(_to_infoway_crypto(s) for s in crypto_syms)
            try:
                res = await client.get(
                    f"{INFOWAY_REST}/crypto/batch_trade/{crypto_codes}",
                    headers={"apiKey": API_KEY},
                )
                result = res.json()
                if result.get("ret") == 200 and result.get("data"):
                    all_data.extend(result["data"])
            except Exception as e:
                print(f"[Market Proxy] crypto trade error: {e}")

    return JSONResponse(content={
        "ret": 200,
        "msg": "success",
        "data": all_data,
    })


@router.get("/depth/{codes}")
async def get_depth(codes: str):
    """Proxy: GET order book depth from InfoWay."""
    is_crypto = _is_crypto(codes.split(",")[0])
    prefix = "/crypto" if is_crypto else "/common"

    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            f"{INFOWAY_REST}{prefix}/batch_depth/{codes}",
            headers={"apiKey": API_KEY},
        )
        return JSONResponse(content=res.json(), status_code=res.status_code)
