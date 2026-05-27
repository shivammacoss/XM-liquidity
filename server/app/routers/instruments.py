"""
XMLiquidity — Instruments Router
List tradeable instruments by segment.
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.instrument import Instrument

router = APIRouter(prefix="/instruments", tags=["Instruments"])


@router.get("/")
async def list_instruments(
    user: User = Depends(get_current_user),
    segment: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """List all active instruments, optionally filtered by segment or search."""
    query = Instrument.find(Instrument.is_active == True, Instrument.is_hidden == False)

    if segment:
        from app.models.instrument import Segment
        try:
            seg_enum = Segment(segment.lower())
            query = query.find(Instrument.segment == seg_enum)
        except ValueError:
            query = query.find(Instrument.segment == segment)

    instruments = await query.sort("sort_order").to_list()

    # Apply search filter in Python (simple text search)
    if search:
        search_lower = search.lower()
        instruments = [
            i for i in instruments
            if search_lower in i.symbol.lower() or search_lower in i.display_name.lower()
        ]

    return [
        {
            "symbol": i.symbol,
            "display_name": i.display_name,
            "segment": i.segment.value,
            "pip_size": i.pip_size,
            "lot_size": i.lot_size,
            "min_lot": i.min_lot,
            "max_lot": i.max_lot,
            "trading_hours": i.trading_hours,
        }
        for i in instruments
    ]


@router.get("/segments")
async def list_segments(user: User = Depends(get_current_user)):
    """List all available trading segments with instrument counts."""
    instruments = await Instrument.find(Instrument.is_active == True, Instrument.is_hidden == False).to_list()

    segment_counts = {}
    for i in instruments:
        seg = i.segment.value
        segment_counts[seg] = segment_counts.get(seg, 0) + 1

    return [
        {"segment": seg, "count": count}
        for seg, count in sorted(segment_counts.items())
    ]
