"""
Structured logging configuration.

Sets up rotating file handler + colored console handler with a consistent
format so every module logger is handled uniformly.
"""
import logging
import logging.handlers
import os
from pathlib import Path

from app.core.config import settings


def setup_logging() -> None:
    """Configure root logger with file + console handlers."""
    log_path = Path(settings.LOG_DIR) / "ytapi.log"
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)

    # -----------------------------------------------------------------------
    # Formatter
    # -----------------------------------------------------------------------
    formatter = logging.Formatter(settings.LOG_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")

    # -----------------------------------------------------------------------
    # Rotating file handler (10 MB × 5 backups)
    # -----------------------------------------------------------------------
    fh = logging.handlers.RotatingFileHandler(
        str(log_path),
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setLevel(level)
    fh.setFormatter(formatter)

    # -----------------------------------------------------------------------
    # Console handler
    # -----------------------------------------------------------------------
    ch = logging.StreamHandler()
    ch.setLevel(level)
    ch.setFormatter(formatter)

    root.addHandler(fh)
    root.addHandler(ch)

    # Silence noisy third-party loggers
    for lib in ("urllib3", "httpx", "asyncio"):
        logging.getLogger(lib).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger (call *after* setup_logging)."""
    return logging.getLogger(name)
