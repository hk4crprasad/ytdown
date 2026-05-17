"""
token_bootstrap.py — runs at FastAPI import time.

Reads the TOKENS_JSON environment variable and writes it to the token file
path configured in settings. This is the Heroku-safe way to inject OAuth
tokens without committing them to git or relying on shell scripts.

Import order matters: this must be imported BEFORE any pytubefix call.
"""
import json
import logging
import os
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)


def bootstrap_tokens() -> bool:
    """
    Write TOKENS_JSON env var → settings.TOKEN_FILE on disk.

    Returns True if tokens were written/already present, False otherwise.
    """
    token_path = Path(settings.TOKEN_FILE)
    tokens_json = os.environ.get("TOKENS_JSON", "").strip()

    if not tokens_json:
        if token_path.exists():
            logger.info("token_bootstrap: using existing token file at %s", token_path)
            return True
        logger.warning(
            "token_bootstrap: TOKENS_JSON env var not set and %s not found. "
            "Pytubefix will run UNAUTHENTICATED — YouTube may block requests.",
            token_path,
        )
        return False

    # Validate JSON before writing so a malformed env var doesn't corrupt the file
    try:
        data = json.loads(tokens_json)
    except json.JSONDecodeError as exc:
        logger.error("token_bootstrap: TOKENS_JSON is not valid JSON — %s", exc)
        return False

    token_path.parent.mkdir(parents=True, exist_ok=True)
    with open(token_path, "w") as f:
        json.dump(data, f, indent=2)

    logger.info(
        "token_bootstrap: tokens written to %s (expires=%s)",
        token_path,
        data.get("expires"),
    )
    return True


# Run at import time so tokens are on disk before any YouTube() call
bootstrap_tokens()
