"""
Cloudflare Turnstile verification dependency.

Usage in a router:
    from app.middleware.turnstile import verify_turnstile

    @router.get("/search")
    async def search(q: str, _: None = Depends(verify_turnstile)):
        ...
"""

import os
import httpx
from fastapi import Depends, HTTPException, Request

TURNSTILE_SECRET   = os.getenv("TURNSTILE_SECRET_KEY", "")
VERIFY_URL         = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_ENABLED  = bool(TURNSTILE_SECRET)   # auto-disabled in dev if key not set


async def verify_turnstile(request: Request) -> None:
    """
    FastAPI dependency — verifies the Cloudflare Turnstile token sent by the
    browser in the `X-CF-Turnstile-Token` request header.

    - If TURNSTILE_SECRET_KEY is not configured (local dev), verification is
      skipped entirely so development is not blocked.
    - On production, a missing or invalid token returns HTTP 403.
    """
    if not TURNSTILE_ENABLED:
        return  # dev mode — pass through

    token = request.headers.get("X-CF-Turnstile-Token", "").strip()
    if not token:
        raise HTTPException(
            status_code=403,
            detail="Bot protection: missing Turnstile token.",
        )

    # Cloudflare recommends including the visitor IP for extra accuracy.
    # On Heroku the real IP is in CF-Connecting-IP (if proxied through CF)
    # or X-Forwarded-For otherwise.
    remote_ip = (
        request.headers.get("CF-Connecting-IP")
        or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (request.client.host if request.client else "")
    )

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                VERIFY_URL,
                data={
                    "secret":   TURNSTILE_SECRET,
                    "response": token,
                    "remoteip": remote_ip,
                },
            )
            result = resp.json()
        except httpx.RequestError as exc:
            # Network problem reaching Cloudflare — fail open to avoid blocking
            # real users due to Cloudflare outage.
            import logging
            logging.getLogger(__name__).warning(
                "Turnstile verification request failed: %s", exc
            )
            return

    if not result.get("success"):
        error_codes = result.get("error-codes", [])
        raise HTTPException(
            status_code=403,
            detail=f"Bot protection: Turnstile verification failed. {error_codes}",
        )
