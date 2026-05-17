"""
Video information, stream listing, best stream, and thumbnail endpoints.

GET /video/info      — full metadata
GET /video/streams   — all streams with filtering
GET /video/best      — highest-resolution stream info
GET /video/download  — streaming download response
GET /video/thumbnails — all thumbnail URLs
"""
from __future__ import annotations

import logging
import mimetypes
import urllib.request
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.dependencies import get_token_file
from app.middleware.turnstile import verify_turnstile
from app.schemas.schemas import (
    StreamInfo, StreamsResponse, ThumbnailsResponse, VideoInfoResponse,
)
from app.services.youtube_service import (
    get_all_streams, get_best_stream, get_stream_by_itag,
    get_thumbnails, get_video_info,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Video"], dependencies=[Depends(verify_turnstile)])


# ---------------------------------------------------------------------------
# /video/info
# ---------------------------------------------------------------------------
@router.get(
    "/video/info",
    response_model=VideoInfoResponse,
    summary="Get complete video metadata",
    description=(
        "Returns title, description, views, likes, publish date, duration, "
        "author, keywords, thumbnails, chapters, captions list, and more."
    ),
)
async def video_info(
    url: str = Query(..., description="YouTube watch URL or youtu.be short URL"),
    token_file: Optional[str] = Depends(get_token_file),
):
    return get_video_info(url, token_file=token_file)


# ---------------------------------------------------------------------------
# /video/streams
# ---------------------------------------------------------------------------
@router.get(
    "/video/streams",
    response_model=StreamsResponse,
    summary="List all available streams",
    description=(
        "Returns every stream (progressive, adaptive, audio-only, video-only). "
        "Supports codec, resolution, mime, adaptive/progressive filtering via query params."
    ),
)
async def video_streams(
    url: str = Query(...),
    resolution: Optional[str] = Query(None, description="e.g. 720p, 1080p"),
    mime_type: Optional[str] = Query(None, description="e.g. video/mp4"),
    only_audio: bool = Query(False),
    only_video: bool = Query(False),
    progressive: Optional[bool] = Query(None),
    adaptive: Optional[bool] = Query(None),
    is_dash: Optional[bool] = Query(None),
    video_codec: Optional[str] = Query(None),
    audio_codec: Optional[str] = Query(None),
    token_file: Optional[str] = Depends(get_token_file),
):
    from pytubefix import YouTube
    import os
    tok = token_file
    if tok and not os.path.exists(tok):
        tok = None
    yt = YouTube(url, token_file=tok)
    yt.check_availability()

    sq = yt.streams
    if resolution:
        sq = sq.filter(resolution=resolution)
    if mime_type:
        sq = sq.filter(mime_type=mime_type)
    if only_audio:
        sq = sq.filter(only_audio=True)
    if only_video:
        sq = sq.filter(only_video=True)
    if progressive is not None:
        sq = sq.filter(progressive=progressive)
    if adaptive is not None:
        sq = sq.filter(adaptive=adaptive)
    if is_dash is not None:
        sq = sq.filter(is_dash=is_dash)
    if video_codec:
        sq = sq.filter(video_codec=video_codec)
    if audio_codec:
        sq = sq.filter(audio_codec=audio_codec)

    from app.services.youtube_service import _stream_to_schema
    all_s = [_stream_to_schema(s) for s in sq]
    prog  = [s for s in all_s if s.is_progressive]
    adapt = [s for s in all_s if s.is_adaptive]
    audio = [s for s in all_s if s.includes_audio_track and not s.includes_video_track]
    video_only = [s for s in all_s if s.includes_video_track and not s.includes_audio_track]

    return StreamsResponse(
        video_id=yt.video_id,
        title=yt.title,
        total=len(all_s),
        progressive=prog,
        adaptive=adapt,
        audio_only=audio,
        video_only=video_only,
        all_streams=all_s,
    )


# ---------------------------------------------------------------------------
# /video/best
# ---------------------------------------------------------------------------
@router.get(
    "/video/best",
    response_model=StreamInfo,
    summary="Get best quality stream info",
)
async def video_best(
    url: str = Query(...),
    progressive: bool = Query(True, description="Prefer progressive streams"),
    token_file: Optional[str] = Depends(get_token_file),
):
    stream = get_best_stream(url, token_file=token_file, progressive=progressive)
    if not stream:
        raise HTTPException(status_code=404, detail="No suitable stream found.")
    return stream


# ---------------------------------------------------------------------------
# /video/download  — streaming response with range support
# ---------------------------------------------------------------------------
@router.get(
    "/video/download",
    summary="Stream video directly to client",
    description=(
        "Proxies the YouTube stream bytes to the HTTP client. "
        "Supports `itag` selection; defaults to best progressive stream."
    ),
)
async def video_download(
    url: str = Query(...),
    itag: Optional[int] = Query(None, description="Stream itag; omit for best quality"),
    token_file: Optional[str] = Depends(get_token_file),
):
    if itag:
        stream_info = get_stream_by_itag(url, itag, token_file=token_file)
    else:
        stream_info = get_best_stream(url, token_file=token_file)

    if not stream_info:
        raise HTTPException(status_code=404, detail="Stream not found.")

    media_url = stream_info.url
    content_type = stream_info.mime_type or "application/octet-stream"

    def iter_stream():
        try:
            req = urllib.request.urlopen(media_url, timeout=settings.STREAM_TIMEOUT)
            while True:
                chunk = req.read(settings.CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
        except Exception as e:
            logger.error("Stream error: %s", e)

    filename = f"video_{stream_info.itag}.{stream_info.subtype}"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Accept-Ranges": "bytes",
    }
    if stream_info.filesize:
        headers["Content-Length"] = str(stream_info.filesize)

    return StreamingResponse(iter_stream(), media_type=content_type, headers=headers)


# ---------------------------------------------------------------------------
# /video/thumbnails
# ---------------------------------------------------------------------------
@router.get(
    "/video/thumbnails",
    response_model=ThumbnailsResponse,
    summary="Get all available thumbnail URLs",
)
async def video_thumbnails(
    url: str = Query(...),
    token_file: Optional[str] = Depends(get_token_file),
):
    return get_thumbnails(url, token_file=token_file)
