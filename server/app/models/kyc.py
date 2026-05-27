"""
XMLiquidity — KYC Document Model
ID + Address Proof + Selfie.
Auto quality check → manual admin review.
"""

from datetime import datetime, timezone
from typing import Optional
from enum import Enum

from beanie import Document, PydanticObjectId
from pydantic import Field


class DocType(str, Enum):
    GOVERNMENT_ID = "government_id"       # Passport, driving license, national ID
    ADDRESS_PROOF = "address_proof"       # Utility bill, bank statement
    SELFIE = "selfie"                     # Photo holding ID


class KYCStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class KYCDocument(Document):
    user_id: PydanticObjectId
    doc_type: DocType
    file_path: str                        # Server-side file path (never exposed)

    # Auto quality check
    auto_check: dict = Field(default_factory=dict)
    # {"quality_ok": true, "format_ok": true, "file_size_ok": true}

    status: KYCStatus = KYCStatus.PENDING
    rejection_reason: Optional[str] = None

    reviewed_by: Optional[PydanticObjectId] = None
    reviewed_at: Optional[datetime] = None

    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "kyc_documents"
