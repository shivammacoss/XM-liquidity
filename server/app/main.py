"""
SwisTrade — FastAPI Application Entry Point
All security middleware configured here. Database never exposed to frontend.
"""
# --- Backend testing By Hari ---# 
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import init_db, close_db
from app.services.auth_service import create_super_admin_if_not_exists

# --- Rate Limiter ---
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # --- STARTUP ---
    print(f"[STARTUP] {settings.app_name} API starting...")
    print(f"[STARTUP] Environment: {settings.app_env}")

    # Connect to MongoDB
    await init_db()
    print("[STARTUP] MongoDB connected")

    # Create super admin if first run
    await create_super_admin_if_not_exists(
        settings.super_admin_email,
        settings.super_admin_password,
    )

    # Seed instruments on first run
    from app.seed_instruments import seed_instruments
    await seed_instruments()

    # Seed default account type settings
    from app.seed_defaults import seed_account_types, seed_default_charges
    await seed_account_types()
    await seed_default_charges()

    yield

    # --- SHUTDOWN ---
    await close_db()
    print("[SHUTDOWN] MongoDB disconnected")


# --- Create App ---
app = FastAPI(
    title=f"{settings.app_name} API",
    version=settings.api_version,
    lifespan=lifespan,
    # Disable docs in production — never expose API schema publicly
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)

# --- Rate Limiting ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS ---
# Only allow requests from our own frontend domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Request-ID"],
    max_age=600,  # Cache preflight for 10 minutes
)

# --- Security Headers Middleware ---
@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Add security headers to every response."""
    response = await call_next(request)

    # Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Strict transport (HTTPS only in production)
    if settings.app_env == "production":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    # Don't leak server info
    response.headers["Server"] = "SwisTrade"
    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    return response


# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch all unhandled exceptions.
    In production: return generic message. Never leak stack traces.
    """
    if settings.debug:
        # In development, show the error for debugging
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": str(exc)},
        )
    # In production, never expose internal errors
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# --- Register Routers ---
from app.routers.auth import router as auth_router
from app.routers.accounts import router as accounts_router
from app.routers.wallet import router as wallet_router
from app.routers.trades import router as trades_router
from app.routers.prop import router as prop_router
from app.routers.ib import router as ib_router
from app.routers.copy_trading import router as copy_router
from app.routers.bot import router as bot_router
from app.routers.challenges import router as challenges_router
from app.routers.users import router as users_router
from app.routers.instruments import router as instruments_router
from app.routers.admin.dashboard import router as admin_router
from app.routers.notifications import router as notifications_router
from app.routers.banking import router as banking_router
from app.routers.admin.notifications import router as admin_notif_router
from app.routers.market_data import router as market_data_router

api_prefix = f"/api/{settings.api_version}"
app.include_router(auth_router, prefix=api_prefix)
app.include_router(accounts_router, prefix=api_prefix)
app.include_router(wallet_router, prefix=api_prefix)
app.include_router(trades_router, prefix=api_prefix)
app.include_router(prop_router, prefix=api_prefix)
app.include_router(ib_router, prefix=api_prefix)
app.include_router(copy_router, prefix=api_prefix)
app.include_router(bot_router, prefix=api_prefix)
app.include_router(challenges_router, prefix=api_prefix)
app.include_router(users_router, prefix=api_prefix)
app.include_router(instruments_router, prefix=api_prefix)
app.include_router(notifications_router, prefix=api_prefix)
app.include_router(banking_router, prefix=api_prefix)
app.include_router(admin_router, prefix=api_prefix)
app.include_router(admin_notif_router, prefix=api_prefix)
app.include_router(market_data_router, prefix=api_prefix)


# --- Health Check (no auth required) ---
@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": settings.app_name}


# --- Root redirect ---
@app.get("/", tags=["System"])
async def root():
    return {"message": f"{settings.app_name} API", "version": settings.api_version}
