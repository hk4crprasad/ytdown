"""
Token management service.

Thread-safe, atomic token file replacement with backup and validation.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.schemas.schemas import TokenStatusResponse, TokenUploadResponse

logger = logging.getLogger(__name__)
_token_lock = threading.Lock()


def upload_token(content: bytes) -> TokenUploadResponse:
    """
    Validate JSON content and atomically replace tokens.json.
    Old file is backed up before replacement.
    """
    # 1. Basic validation
    if not content:
        raise ValueError("Uploaded file is empty.")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {exc}") from exc

    if not isinstance(parsed, (dict, list)):
        raise ValueError("Token file must be a JSON object or array.")

    token_path = Path(settings.TOKEN_FILE)
    backup_dir = Path(settings.TOKEN_BACKUP_DIR)
    backup_dir.mkdir(parents=True, exist_ok=True)

    with _token_lock:
        # 2. Backup old file if it exists
        if token_path.exists():
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_path = backup_dir / f"tokens_{ts}.json.bak"
            try:
                shutil.copy2(str(token_path), str(backup_path))
                logger.info("Token backup created: %s", backup_path)
            except Exception as e:
                logger.warning("Could not create backup: %s", e)

        # 3. Atomic write via temp file
        tmp_path = token_path.with_suffix(".tmp")
        try:
            tmp_path.write_bytes(content)
            tmp_path.replace(token_path)
            logger.info("tokens.json replaced successfully (%d bytes)", len(content))
        except Exception as exc:
            if tmp_path.exists():
                tmp_path.unlink(missing_ok=True)
            raise RuntimeError(f"File write failed: {exc}") from exc

    return TokenUploadResponse(success=True, message="tokens.json updated successfully")


def get_token_status() -> TokenStatusResponse:
    """Return the current status of the token file."""
    token_path = Path(settings.TOKEN_FILE)

    if not token_path.exists():
        return TokenStatusResponse(exists=False, valid=False, ready=False)

    size = token_path.stat().st_size
    last_updated = datetime.utcfromtimestamp(
        token_path.stat().st_mtime
    ).isoformat()

    valid = False
    try:
        data = json.loads(token_path.read_bytes())
        valid = isinstance(data, (dict, list)) and bool(data)
    except Exception:
        pass

    return TokenStatusResponse(
        exists=True,
        valid=valid,
        size=size,
        last_updated=last_updated,
        ready=valid,
    )
