"""
XMLiquidity — Application Configuration
Loads all settings from environment variables. Never hardcode secrets.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List


class Settings(BaseSettings):
    # --- App ---
    app_name: str = "XMLiquidity"
    app_env: str = "development"
    debug: bool = True
    api_version: str = "v1"
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # --- MongoDB ---
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "protrader"

    # --- JWT ---
    jwt_secret_key: str = Field(..., min_length=32)
    jwt_refresh_secret_key: str = Field(..., min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # --- Security ---
    bcrypt_rounds: int = 12
    rate_limit_per_minute: int = 60
    rate_limit_login_per_minute: int = 5

    # --- File Uploads ---
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 10

    # --- InfoWay API ---
    infoway_api_key: str = ""
    infoway_rest_base: str = "https://data.infoway.io"
    infoway_ws_base: str = "wss://data.infoway.io/ws"

    # --- Platform Wallets ---
    platform_btc_address: str = ""
    platform_eth_address: str = ""
    platform_usdt_address: str = ""

    # --- Super Admin ---
    super_admin_email: str = "admin@protrader.com"
    super_admin_password: str = ""

    # --- Public URLs (webhook links shown to users; must hit this API from the internet) ---
    # Example: https://api.yourdomain.com  or  http://localhost:8000  for local testing with tunnels
    public_api_base_url: str = ""

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
