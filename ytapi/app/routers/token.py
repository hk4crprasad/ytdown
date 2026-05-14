"""
Token management endpoints.

POST /upload/token  — upload & replace tokens.json
GET  /token/status  — inspect current token state
"""
import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.schemas import TokenStatusResponse, TokenUploadResponse
from app.services.token_service import get_token_status, upload_token

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Token Management"])


@router.post(
    "/upload/token",
    response_model=TokenUploadResponse,
    summary="Upload / replace tokens.json",
    description=(
        "Upload a new `tokens.json` file. The old file is backed up atomically "
        "before replacement. The server does **not** restart — new tokens are "
        "picked up immediately on the next request."
    ),
)
async def upload_token_file(
    file: UploadFile = File(..., description="tokens.json file (must be valid JSON)")
):
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only .json files are accepted.")

    content = await file.read()
    try:
        result = upload_token(content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    logger.info("Token file uploaded via API: %s bytes", len(content))
    return result


@router.get(
    "/token/status",
    response_model=TokenStatusResponse,
    summary="Get token file status",
    description="Check whether tokens.json exists, is valid JSON, and the API is ready to use.",
)
async def token_status():
    return get_token_status()
