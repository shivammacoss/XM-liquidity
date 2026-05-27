"""
XMLiquidity — Challenges & Competitions Router
Join challenges, view leaderboard, track results.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.challenge import Challenge, ChallengeEntry, ChallengeStatus
from app.models.account import TradingAccount

router = APIRouter(prefix="/challenges", tags=["Challenges & Competitions"])


@router.get("/")
async def list_challenges(
    user: User = Depends(get_current_user),
    status_filter: str = Query(None, alias="status"),
    type_filter: str = Query(None, alias="type"),
):
    """List all challenges (upcoming, active, completed)."""
    query = Challenge.find()
    if status_filter:
        query = query.find(Challenge.status == status_filter)
    if type_filter:
        query = query.find(Challenge.type == type_filter)

    challenges = await query.sort("-start_at").to_list()

    # Check which ones user has joined
    my_entries = await ChallengeEntry.find(ChallengeEntry.user_id == user.id).to_list()
    joined_ids = {str(e.challenge_id) for e in my_entries}

    return [
        {
            "id": str(c.id),
            "title": c.title,
            "description": c.description,
            "type": c.type.value,
            "category": c.category.value,
            "status": c.status.value,
            "start_at": c.start_at.isoformat(),
            "end_at": c.end_at.isoformat(),
            "participant_count": c.participant_count,
            "entry_fee": c.entry_fee,
            "rewards": c.rewards,
            "is_joined": str(c.id) in joined_ids,
        }
        for c in challenges
    ]


@router.post("/{challenge_id}/join", status_code=201)
async def join_challenge(
    challenge_id: str,
    account_id: str = Query(...),
    user: User = Depends(get_current_user),
):
    """Join a challenge with a specific trading account."""
    challenge = await Challenge.get(challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    if challenge.status != ChallengeStatus.ACTIVE and challenge.status != ChallengeStatus.UPCOMING:
        raise HTTPException(status_code=400, detail="Challenge is not accepting participants")

    # Check if already joined
    existing = await ChallengeEntry.find_one(
        ChallengeEntry.challenge_id == challenge.id,
        ChallengeEntry.user_id == user.id,
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already joined this challenge")

    # Verify account
    account = await TradingAccount.get(account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found")

    # Check qualifying account types
    if challenge.qualifying_account_types and account.account_type.value not in challenge.qualifying_account_types:
        raise HTTPException(status_code=400, detail=f"Account type {account.account_type.value} not eligible")

    # Check entry fee
    if challenge.entry_fee > 0:
        from app.models.wallet import Wallet
        wallet = await Wallet.find_one(Wallet.user_id == user.id)
        if not wallet or wallet.balance < challenge.entry_fee:
            raise HTTPException(status_code=400, detail="Insufficient balance for entry fee")
        wallet.balance -= challenge.entry_fee
        await wallet.save()

    entry = ChallengeEntry(
        challenge_id=challenge.id,
        user_id=user.id,
        account_id=account.id,
        metrics={
            "total_pnl": 0, "lots_traded": 0, "total_trades": 0,
            "win_count": 0, "loss_count": 0, "win_rate": 0,
            "avg_hold_time_minutes": 0, "max_drawdown": 0,
        },
    )
    await entry.insert()

    challenge.participant_count += 1
    await challenge.save()

    return {"message": "Joined challenge successfully", "entry_id": str(entry.id)}


@router.get("/{challenge_id}/leaderboard")
async def get_leaderboard(challenge_id: str, user: User = Depends(get_current_user)):
    """Get the leaderboard for a specific challenge."""
    challenge = await Challenge.get(challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    entries = await ChallengeEntry.find(
        ChallengeEntry.challenge_id == challenge.id
    ).sort("-score").to_list()

    leaderboard = []
    for i, e in enumerate(entries, 1):
        u = await User.get(e.user_id)
        leaderboard.append({
            "rank": i,
            "user_name": u.name if u else "Unknown",
            "user_id": str(e.user_id),
            "score": round(e.score, 2),
            "metrics": e.metrics,
            "is_me": e.user_id == user.id,
        })

    return {
        "challenge": {
            "title": challenge.title,
            "type": challenge.type.value,
            "category": challenge.category.value,
            "status": challenge.status.value,
            "rewards": challenge.rewards,
        },
        "leaderboard": leaderboard,
    }
