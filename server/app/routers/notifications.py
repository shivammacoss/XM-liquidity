"""
XMLiquidity — Notifications Router (User Side)
List notifications, mark as read, get unread count.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
async def list_notifications(
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    unread_only: bool = Query(False),
):
    """List user's notifications with pagination."""
    query = Notification.find(Notification.user_id == user.id)
    if unread_only:
        query = query.find(Notification.is_read == False)

    total = await query.count()
    skip = (page - 1) * per_page
    notifs = await query.sort("-created_at").skip(skip).limit(per_page).to_list()

    return {
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type.value,
                "title": n.title,
                "message": n.message,
                "priority": n.priority.value,
                "action_url": n.action_url,
                "is_read": n.is_read,
                "requires_action": n.requires_action,
                "action_status": n.action_status,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifs
        ],
        "total": total,
        "unread_count": await Notification.find(
            Notification.user_id == user.id, Notification.is_read == False
        ).count(),
        "page": page,
    }


@router.get("/unread-count")
async def get_unread_count(user: User = Depends(get_current_user)):
    """Get unread notification count (for badge)."""
    count = await Notification.find(
        Notification.user_id == user.id, Notification.is_read == False
    ).count()
    return {"unread_count": count}


@router.post("/{notification_id}/read")
async def mark_as_read(notification_id: str, user: User = Depends(get_current_user)):
    """Mark a notification as read."""
    notif = await Notification.get(notification_id)
    if notif and notif.user_id == user.id:
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        await notif.save()
    return {"message": "Marked as read"}


@router.post("/read-all")
async def mark_all_as_read(user: User = Depends(get_current_user)):
    """Mark all notifications as read."""
    await Notification.find(
        Notification.user_id == user.id, Notification.is_read == False
    ).update({"$set": {"is_read": True, "read_at": datetime.now(timezone.utc)}})
    return {"message": "All notifications marked as read"}
