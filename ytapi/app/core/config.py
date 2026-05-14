"""
Application configuration management.

Loads settings from environment variables (via .env file) with sensible
defaults. All runtime paths and tunables are centralized here.
"""
import os
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings
from pydantic import Field


# ---------------------------------------------------------------------------
# Base directories (resolved relative to the project root)
# ---------------------------------------------------------------------------
BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Main application settings."""

    # -----------------------------------------------------------------------
    # Server
    # -----------------------------------------------------------------------
    APP_TITLE: str = "YouTube Media Extraction API"
    APP_DESCRIPTION: str = (
        "Production-grade SaaS YouTube downloader & streaming backend "
        "powered by FastAPI + pytubefix."
    )
    APP_VERSION: str = "1.0.0"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    DEBUG: bool = False

    # -----------------------------------------------------------------------
    # CORS
    # -----------------------------------------------------------------------
    CORS_ORIGINS: List[str] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]

    # -----------------------------------------------------------------------
    # Token / OAuth
    # -----------------------------------------------------------------------
    TOKEN_FILE: str = str(BASE_DIR / "tokens.json")
    TOKEN_BACKUP_DIR: str = str(BASE_DIR / "token_backups")

    # -----------------------------------------------------------------------
    # Paths
    # -----------------------------------------------------------------------
    DOWNLOAD_DIR: str = str(BASE_DIR / "downloads")
    TEMP_DIR: str = str(BASE_DIR / "temp")
    LOG_DIR: str = str(BASE_DIR / "logs")

    # -----------------------------------------------------------------------
    # Streaming
    # -----------------------------------------------------------------------
    CHUNK_SIZE: int = 1024 * 512          # 512 KB per streaming chunk
    MAX_DOWNLOAD_SIZE_MB: int = 2048      # Guard against absurd requests
    STREAM_TIMEOUT: int = 30             # seconds
    MAX_RETRIES: int = 3

    # -----------------------------------------------------------------------
    # Rate limiting (for future middleware wiring)
    # -----------------------------------------------------------------------
    RATE_LIMIT_ENABLED: bool = False
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60          # seconds

    # -----------------------------------------------------------------------
    # pytubefix client
    # -----------------------------------------------------------------------
    DEFAULT_CLIENT: str = "IOS"          # IOS is reliable without po_token

    # -----------------------------------------------------------------------
    # Logging
    # -----------------------------------------------------------------------
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# Ensure critical directories exist at import time
for _dir in [
    settings.DOWNLOAD_DIR,
    settings.TEMP_DIR,
    settings.LOG_DIR,
    settings.TOKEN_BACKUP_DIR,
]:
    os.makedirs(_dir, exist_ok=True)
