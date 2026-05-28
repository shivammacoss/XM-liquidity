from datetime import datetime, timezone
from typing import Optional
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import EmailStr, Field


class SignupRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SignupRequest(Document):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    message: Optional[str] = None

    status: SignupRequestStatus = SignupRequestStatus.PENDING

    reviewed_by: Optional[PydanticObjectId] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    created_user_id: Optional[PydanticObjectId] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "signup_requests"
