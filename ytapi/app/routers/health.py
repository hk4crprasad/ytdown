"""
Health check endpoint.
"""
import time

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.schemas import HealthResponse
from app.services.token_service import get_token_status

router = APIRouter(tags=["Health"])
_start = time.time()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="API health check",
)
async def health():
    tok = get_token_status()
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        token_ready=tok.ready,
        download_dir=settings.DOWNLOAD_DIR,
        uptime_seconds=round(time.time() - _start, 2),
    )
