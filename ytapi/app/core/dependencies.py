"""
Dependency injection helpers.

Centralises all FastAPI ``Depends`` callables used across routers.
"""
import logging
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_token_file() -> Optional[str]:
    """Return the path to tokens.json if the file exists and is readable.

    Returns ``None`` when the token file is absent (unauthenticated mode).
    """
    path = Path(settings.TOKEN_FILE)
    if path.exists() and path.is_file():
        logger.debug("Token file resolved: %s", path)
        return str(path)
    logger.debug("Token file not found – running in unauthenticated mode.")
    return None


def require_token_file() -> str:
    """Like ``get_token_file`` but raises 503 if the token is missing."""
    tok = get_token_file()
    if tok is None:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "TOKEN_MISSING",
                "message": (
                    "tokens.json not found. "
                    "Upload a valid token file via POST /upload/token."
                ),
            },
        )
    return tok
