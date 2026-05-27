"""
XMLiquidity — User Profile, KYC, Read-Only ID Router
"""

import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional

from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.kyc import KYCDocument, DocType, KYCStatus
from app.utils.security import hash_password, verify_password
from app.config import settings

router = APIRouter(prefix="/users", tags=["Profile & KYC"])


# --- Profile ---

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    avatar_type: Optional[str] = None


@router.patch("/profile")
async def update_profile(data: UpdateProfileRequest, user: User = Depends(get_current_user)):
    """Update user profile details."""
    if data.name is not None:
        user.name = data.name.strip()
    if data.phone is not None:
        user.phone = data.phone.strip()
    if data.avatar_type is not None:
        user.avatar_type = data.avatar_type
    user.updated_at = datetime.now(timezone.utc)
    await user.save()

    from app.services.auth_service import user_to_public
    return {"user": user_to_public(user).model_dump()}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


@router.post("/change-password")
async def change_password(data: ChangePasswordRequest, user: User = Depends(get_current_user)):
    """Change password. Requires current password verification."""
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.password_hash = hash_password(data.new_password)
    user.updated_at = datetime.now(timezone.utc)
    await user.save()

    # Invalidate all other sessions for security
    from app.services.auth_service import invalidate_all_sessions
    await invalidate_all_sessions(user.id)

    return {"message": "Password changed. All other sessions have been logged out."}


# --- Read-Only ID ---

class CreateReadOnlyRequest(BaseModel):
    password: str = Field(..., min_length=4, max_length=32)


@router.post("/read-only-id")
async def create_read_only_id(data: CreateReadOnlyRequest, user: User = Depends(get_current_user)):
    """Create a read-only password. Others can view your dashboard as spectator."""
    user.read_only_password = hash_password(data.password)
    await user.save()

    return {
        "read_only_id": user.email,
        "message": "Read-only access created. Share your email + read-only password to let others view your dashboard.",
    }


class ReadOnlyLoginRequest(BaseModel):
    email: str
    read_only_password: str


@router.post("/read-only-login")
async def read_only_login(data: ReadOnlyLoginRequest):
    """Login with read-only credentials. Returns limited access token."""
    target_user = await User.find_one(User.email == data.email.lower())
    if not target_user or not target_user.read_only_password:
        raise HTTPException(status_code=401, detail="Invalid read-only credentials")

    if not verify_password(data.read_only_password, target_user.read_only_password):
        raise HTTPException(status_code=401, detail="Invalid read-only credentials")

    from app.utils.security import create_access_token
    token = create_access_token(
        data={"sub": str(target_user.id), "role": "readonly", "is_readonly": True}
    )
    from app.services.auth_service import user_to_public
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_to_public(target_user).model_dump(),
        "is_readonly": True,
    }


# --- KYC ---

@router.post("/kyc/upload", status_code=201)
async def upload_kyc_document(
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Upload a KYC document (government_id, address_proof, or selfie)."""
    valid_types = ["government_id", "address_proof", "selfie"]
    if doc_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid doc type. Must be: {', '.join(valid_types)}")

    # Validate file
    allowed_extensions = {".jpg", ".jpeg", ".png", ".pdf"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="File must be JPG, PNG, or PDF")

    max_size = settings.max_upload_size_mb * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail=f"File too large. Max {settings.max_upload_size_mb}MB")

    # Save file
    filename = f"{user.id}_{doc_type}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(settings.upload_dir, "kyc", filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    with open(filepath, "wb") as f:
        f.write(content)

    # Auto quality check
    auto_check = {
        "quality_ok": len(content) > 10000,  # At least 10KB
        "format_ok": ext in allowed_extensions,
        "file_size_ok": len(content) <= max_size,
    }

    # Check if existing doc of same type exists
    existing = await KYCDocument.find_one(
        KYCDocument.user_id == user.id,
        KYCDocument.doc_type == DocType(doc_type),
    )
    if existing:
        # Replace existing
        existing.file_path = filepath
        existing.auto_check = auto_check
        existing.status = KYCStatus.PENDING
        existing.uploaded_at = datetime.now(timezone.utc)
        existing.rejection_reason = None
        await existing.save()
    else:
        doc = KYCDocument(
            user_id=user.id,
            doc_type=DocType(doc_type),
            file_path=filepath,
            auto_check=auto_check,
        )
        await doc.insert()

    # Update user KYC status
    all_docs = await KYCDocument.find(KYCDocument.user_id == user.id).to_list()
    doc_types_uploaded = {d.doc_type.value for d in all_docs}
    if doc_types_uploaded >= {"government_id", "address_proof", "selfie"}:
        user.kyc_status = "pending"
    else:
        user.kyc_status = "pending"
    await user.save()

    return {
        "message": f"{doc_type} uploaded successfully",
        "auto_check": auto_check,
        "status": "pending",
    }


@router.get("/kyc/status")
async def get_kyc_status(user: User = Depends(get_current_user)):
    """Get KYC document statuses."""
    docs = await KYCDocument.find(KYCDocument.user_id == user.id).to_list()
    return {
        "overall_status": user.kyc_status.value if hasattr(user.kyc_status, 'value') else user.kyc_status,
        "documents": [
            {
                "doc_type": d.doc_type.value,
                "status": d.status.value,
                "rejection_reason": d.rejection_reason,
                "uploaded_at": d.uploaded_at.isoformat(),
            }
            for d in docs
        ],
    }
