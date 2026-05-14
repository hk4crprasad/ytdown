"""
Captions / subtitles endpoints.

GET /captions/list      — list available captions
GET /captions/download  — download captions in srt/vtt/txt/xml format
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.core.dependencies import get_token_file
from app.schemas.schemas import CaptionDownloadResponse, CaptionsListResponse
from app.services.youtube_service import get_caption_content, get_captions_list

router = APIRouter(tags=["Captions"])


@router.get(
    "/captions/list",
    response_model=CaptionsListResponse,
    summary="List all caption tracks",
    description="Returns available caption/subtitle tracks including auto-generated ones.",
)
async def captions_list(
    url: str = Query(...),
    token_file: Optional[str] = Depends(get_token_file),
):
    return get_captions_list(url, token_file=token_file)


@router.get(
    "/captions/download",
    summary="Download captions in specified format",
    description="Download captions as SRT, TXT, or raw XML. Use `a.en` for auto-generated English.",
)
async def captions_download(
    url: str = Query(...),
    lang_code: str = Query(..., description="Caption language code, e.g. 'en', 'a.en'"),
    fmt: str = Query("srt", description="Output format: srt | txt | xml"),
    raw: bool = Query(False, description="Return as plain text response instead of JSON"),
    token_file: Optional[str] = Depends(get_token_file),
):
    if fmt not in ("srt", "txt", "xml"):
        raise HTTPException(status_code=400, detail="Format must be srt, txt, or xml.")

    result = get_caption_content(url, lang_code, fmt=fmt, token_file=token_file)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Caption '{lang_code}' not found. Use /captions/list to see available tracks.",
        )

    if raw:
        media_map = {"srt": "text/plain", "txt": "text/plain", "xml": "application/xml"}
        return PlainTextResponse(result.content, media_type=media_map[fmt])

    return result
