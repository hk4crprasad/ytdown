"""
token_bootstrap.py — runs at FastAPI import time.

Token resolution order:
  1. Fetch from TOKENS_URL (GitHub raw URL) — always gets the latest version
  2. Fall back to TOKENS_JSON env var
  3. Fall back to existing file on disk

Import order matters: this must be imported BEFORE any pytubefix call.
"""
import json
import logging
import os
import urllib.request
import urllib.error
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# GitHub raw URL to fetch tokens from.
# Set TOKENS_URL env var to override, or use this default.
_DEFAULT_TOKENS_URL = (
    "https://raw.githubusercontent.com/hk4crprasad/ytdown/"
    "refs/heads/cursor/update-build-system/ytapi/tokens.json"
)


def _fetch_from_url(url: str) -> dict | None:
    """Fetch token JSON from a URL. Returns parsed dict or None on failure."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ytapi-bootstrap/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            logger.info("token_bootstrap: fetched tokens from %s (expires=%s)", url, data.get("expires"))
            return data
    except urllib.error.HTTPError as e:
        logger.warning("token_bootstrap: URL fetch failed HTTP %s — %s", e.code, url)
    except Exception as e:
        logger.warning("token_bootstrap: URL fetch failed — %s: %s", type(e).__name__, e)
    return None


def _parse_env_json(env_val: str) -> dict | None:
    """Parse TOKENS_JSON env var. Returns dict or None on failure."""
    try:
        data = json.loads(env_val)
        logger.info("token_bootstrap: loaded tokens from TOKENS_JSON env var (expires=%s)", data.get("expires"))
        return data
    except json.JSONDecodeError as exc:
        logger.error("token_bootstrap: TOKENS_JSON env var is not valid JSON — %s", exc)
    return None


def _write_token_file(token_path: Path, data: dict) -> None:
    token_path.parent.mkdir(parents=True, exist_ok=True)
    with open(token_path, "w") as f:
        json.dump(data, f, indent=2)
    logger.info("token_bootstrap: tokens written to %s", token_path)


def bootstrap_tokens() -> bool:
    """
    Resolve tokens using priority order and write to settings.TOKEN_FILE.
    Returns True if tokens are available, False if running unauthenticated.
    """
    token_path = Path(settings.TOKEN_FILE)

    # ── 1. Try GitHub URL ────────────────────────────────────────────────────
    tokens_url = os.environ.get("TOKENS_URL", _DEFAULT_TOKENS_URL).strip()
    if tokens_url:
        data = _fetch_from_url(tokens_url)
        if data:
            _write_token_file(token_path, data)
            return True

    # ── 2. Try TOKENS_JSON env var ───────────────────────────────────────────
    tokens_json = os.environ.get("TOKENS_JSON", "").strip()
    if tokens_json:
        data = _parse_env_json(tokens_json)
        if data:
            _write_token_file(token_path, data)
            return True

    # ── 3. Use existing file ─────────────────────────────────────────────────
    if token_path.exists():
        logger.info("token_bootstrap: using existing token file at %s", token_path)
        return True

    logger.warning(
        "token_bootstrap: no tokens available — YouTube requests may be blocked as bot."
    )
    return False


# Run at import time so tokens are on disk before any YouTube() call
bootstrap_tokens()
