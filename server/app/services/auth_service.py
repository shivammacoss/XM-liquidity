"""
ProTrader — Auth Service
Business logic for registration, login, token refresh.
All DB queries are here — routers stay thin.
"""

from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.models.session import Session
from app.schemas.auth import RegisterRequest, UserPublic
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
)

# Valid bcrypt hash (password is never revealed) — used when email not found so verify runs real work.
_PASSWORD_TIMING_DUMMY_HASH = (
    "$2b$12$UaswAWioBmx6FVGML5LxyeXTGlagm9J.xzn3SZuA2YW0dCzaeTmI2"
)


async def register_user(data: RegisterRequest) -> User:
    """
    Register a new user. Checks for duplicate email.
    Password is hashed before storage — never stored in plaintext.
    """
    # Check if email already exists
    existing = await User.find_one(User.email == data.email.lower())
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create user with hashed password
    user = User(
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        name=data.name.strip(),
        phone=data.phone,
    )
    await user.insert()
    return user


async def authenticate_user(email: str, password: str) -> User:
    """
    Verify email + password. Returns user or raises 401.
    Uses constant-time password comparison to prevent timing attacks.
    """
    user = await User.find_one(User.email == email.lower().strip())

    if not user:
        # Still run hash comparison to prevent timing-based user enumeration
        verify_password(password, _PASSWORD_TIMING_DUMMY_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated",
        )

    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account blocked. Reason: " + (user.block_reason or "Contact support"),
        )

    return user


def generate_tokens(user: User) -> dict:
    """Generate access + refresh token pair for a user."""
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id)}
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


async def create_session(
    user_id: PydanticObjectId,
    refresh_token_hash: str,
    device_info: str = "",
    ip_address: str = "",
) -> Session:
    """Create a new login session for audit tracking."""
    session = Session(
        user_id=user_id,
        refresh_token_hash=refresh_token_hash,
        device_info=device_info,
        ip_address=ip_address,
        is_active=True,
    )
    await session.insert()
    return session


async def invalidate_session(refresh_token_hash: str):
    """Invalidate a session (logout). Prevents refresh token reuse."""
    session = await Session.find_one(
        Session.refresh_token_hash == refresh_token_hash,
        Session.is_active == True,
    )
    if session:
        session.is_active = False
        await session.save()


async def invalidate_all_sessions(user_id: PydanticObjectId):
    """Invalidate all sessions for a user (password change, security event)."""
    await Session.find(
        Session.user_id == user_id,
        Session.is_active == True,
    ).update({"$set": {"is_active": False}})


def _enum_or_str(value, default: str) -> str:
    """Beanie may load enums as raw strings from older MongoDB documents."""
    if value is None:
        return default
    return value.value if hasattr(value, "value") else str(value)


def user_to_public(user: User) -> UserPublic:
    """Convert User document to safe public response. Never exposes password_hash."""
    created = user.created_at
    created_str = created.isoformat() if created else datetime.now(timezone.utc).isoformat()
    return UserPublic(
        id=str(user.id),
        email=user.email,
        name=user.name,
        phone=user.phone,
        role=_enum_or_str(user.role, "user"),
        kyc_status=_enum_or_str(user.kyc_status, "not_submitted"),
        profile_image=user.profile_image,
        avatar_type=user.avatar_type,
        is_active=user.is_active,
        is_blocked=user.is_blocked,
        is_trading_restricted=user.is_trading_restricted,
        created_at=created_str,
    )


async def create_super_admin_if_not_exists(email: str, password: str):
    """
    Create the initial super admin account on first startup.
    Only runs if no super admin exists yet.
    """
    if not email or not password:
        return

    existing = await User.find_one(User.role == UserRole.SUPER_ADMIN)
    if existing:
        return

    admin = User(
        email=email.lower().strip(),
        password_hash=hash_password(password),
        name="Super Admin",
        role=UserRole.SUPER_ADMIN,
    )
    await admin.insert()
    print(f"[STARTUP] Super admin created: {email}")
