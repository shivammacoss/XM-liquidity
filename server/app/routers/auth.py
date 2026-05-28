"""
XMLiquidity — Auth Router
Signup requests, login, token refresh, logout.
Users cannot self-register. They submit a signup request which
the super admin reviews. The admin creates the account and provides
credentials to the user.
"""

import hashlib
from fastapi import APIRouter, Request, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    MessageResponse,
)
from app.services.auth_service import (
    authenticate_user,
    generate_tokens,
    create_session,
    invalidate_session,
    user_to_public,
)
from app.utils.security import decode_refresh_token
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.signup_request import SignupRequest, SignupRequestStatus

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _hash_token_for_storage(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class SignupRequestBody(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str | None = Field(None, max_length=20)
    message: str | None = Field(None, max_length=500)


@router.post("/signup-request", status_code=status.HTTP_201_CREATED)
async def submit_signup_request(data: SignupRequestBody):
    existing_user = await User.find_one(User.email == data.email.lower())
    if existing_user:
        raise HTTPException(status_code=409, detail="This email is already registered")

    existing_req = await SignupRequest.find_one(
        SignupRequest.email == data.email.lower(),
        SignupRequest.status == SignupRequestStatus.PENDING,
    )
    if existing_req:
        raise HTTPException(status_code=409, detail="A signup request for this email is already pending")

    req = SignupRequest(
        name=data.name.strip(),
        email=data.email.lower().strip(),
        phone=data.phone,
        message=data.message,
    )
    await req.insert()

    from app.services.notification_service import notify_admins
    from app.models.notification import NotificationType, NotificationPriority
    await notify_admins(
        type=NotificationType.SYSTEM_MESSAGE,
        title="New Signup Request",
        message=f"{data.name} ({data.email}) has requested an account",
        from_user_id=None,
        entity_type="signup_request",
        entity_id=str(req.id),
        priority=NotificationPriority.HIGH,
    )

    return {"message": "Your signup request has been submitted. You will receive your credentials via email once approved."}


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request):
    """
    Authenticate user with email + password.
    - Constant-time password comparison (prevents timing attacks)
    - Creates session record for audit
    - Returns JWT tokens
    """
    user = await authenticate_user(data.email, data.password)

    tokens = generate_tokens(user)

    await create_session(
        user_id=user.id,
        refresh_token_hash=_hash_token_for_storage(tokens["refresh_token"]),
        device_info=request.headers.get("User-Agent", ""),
        ip_address=_get_client_ip(request),
    )

    return TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user=user_to_public(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest):
    """
    Exchange a valid refresh token for a new access token.
    - Verifies refresh token signature and expiry
    - Checks session is still active in DB
    - Returns new access token (refresh token stays the same)
    """
    payload = decode_refresh_token(data.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await User.get(user_id)
    if not user or not user.is_active or user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Verify the refresh token's session is still active
    from app.models.session import Session

    token_hash = _hash_token_for_storage(data.refresh_token)
    session = await Session.find_one(
        Session.refresh_token_hash == token_hash,
        Session.is_active == True,
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked",
        )

    # Generate new access token only (refresh token reuse)
    from app.utils.security import create_access_token

    new_access = create_access_token(
        data={"sub": str(user.id), "role": user.role.value}
    )

    # Update session last activity
    from datetime import datetime, timezone

    session.last_activity = datetime.now(timezone.utc)
    await session.save()

    return TokenResponse(
        access_token=new_access,
        user=user_to_public(user),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    data: RefreshRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Logout — invalidates the refresh token session.
    Access token will naturally expire (short-lived).
    """
    token_hash = _hash_token_for_storage(data.refresh_token)
    await invalidate_session(token_hash)

    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=dict)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user's profile.
    Protected endpoint — requires valid access token.
    """
    return {"user": user_to_public(current_user).model_dump()}
