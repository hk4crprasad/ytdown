"""
Shorts endpoints.

GET /shorts/info     — metadata + stream list
GET /shorts/download — streaming response for shorts
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.dependencies import get_token_file
from app.schemas.schemas import ShortsInfoResponse
from app.services.youtube_service import _detect_shorts, _get_thumbnails, _stream_to_schema

import logging
import urllib.request

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Shorts"])


def _build_yt(url: str, token_file: Optional[str]):
    from pytubefix import YouTube
    import os
    tok = token_file
    if tok and not os.path.exists(tok):
        tok = None
    return YouTube(url, token_file=tok)


@router.get(
    "/shorts/info",
    response_model=ShortsInfoResponse,
    summary="Get YouTube Shorts metadata + streams",
)
async def shorts_info(
    url: str = Query(..., description="YouTube Shorts or regular video URL"),
    token_file: Optional[str] = Depends(get_token_file),
):
    yt = _build_yt(url, token_file)
    yt.check_availability()

    streams = [_stream_to_schema(s) for s in yt.streams]
    thumb: Optional[str] = None
    try:
        thumb = yt.thumbnail_url
    except Exception:
        pass

    views: Optional[int] = None
    try:
        views = yt.views
    except Exception:
        pass

    return ShortsInfoResponse(
        video_id=yt.video_id,
        is_shorts=_detect_shorts(yt),
        title=yt.title,
        author=yt.author,
        length_seconds=yt.length,
        views=views,
        thumbnail_url=thumb,
        watch_url=yt.watch_url,
        streams=streams,
    )


@router.get(
    "/shorts/download",
    summary="Stream YouTube Short directly",
)
async def shorts_download(
    url: str = Query(...),
    token_file: Optional[str] = Depends(get_token_file),
):
    yt = _build_yt(url, token_file)
    yt.check_availability()

    stream = yt.streams.get_highest_resolution(progressive=True)
    if not stream:
        stream = yt.streams.get_highest_resolution(progressive=False)
    if not stream:
        raise HTTPException(status_code=404, detail="No stream found.")

    si = _stream_to_schema(stream)

    def iter_bytes():
        try:
            req = urllib.request.urlopen(si.url, timeout=settings.STREAM_TIMEOUT)
            while True:
                chunk = req.read(settings.CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
        except Exception as e:
            logger.error("Shorts stream error: %s", e)

    filename = f"short_{yt.video_id}.{si.subtype}"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    if si.filesize:
        headers["Content-Length"] = str(si.filesize)

    return StreamingResponse(iter_bytes(), media_type=si.mime_type, headers=headers)
