"""
Audio endpoints.

GET /audio/streams  — list all audio-only streams
GET /audio/best     — best audio stream info
GET /audio/download — stream audio bytes to client
"""
from __future__ import annotations

import logging
import urllib.request
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.dependencies import get_token_file
from app.schemas.schemas import AudioStreamsResponse, StreamInfo
from app.services.youtube_service import get_audio_streams, get_stream_by_itag

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Audio"])


@router.get(
    "/audio/streams",
    response_model=AudioStreamsResponse,
    summary="List all audio-only streams",
)
async def audio_streams(
    url: str = Query(...),
    subtype: Optional[str] = Query(None, description="e.g. mp4, webm"),
    token_file: Optional[str] = Depends(get_token_file),
):
    result = get_audio_streams(url, token_file=token_file)
    if subtype:
        result.streams = [s for s in result.streams if s.subtype == subtype]
        result.total = len(result.streams)
    return result


@router.get(
    "/audio/best",
    response_model=StreamInfo,
    summary="Get best audio stream info",
)
async def audio_best(
    url: str = Query(...),
    subtype: Optional[str] = Query("mp4"),
    token_file: Optional[str] = Depends(get_token_file),
):
    from pytubefix import YouTube
    import os
    tok = token_file
    if tok and not os.path.exists(tok):
        tok = None
    yt = YouTube(url, token_file=tok)
    yt.check_availability()
    stream = yt.streams.get_audio_only(subtype=subtype or "mp4")
    if not stream:
        stream = yt.streams.filter(only_audio=True).order_by("abr").last()
    if not stream:
        raise HTTPException(status_code=404, detail="No audio stream found.")
    from app.services.youtube_service import _stream_to_schema
    return _stream_to_schema(stream)


@router.get(
    "/audio/download",
    summary="Stream audio bytes directly to client",
)
async def audio_download(
    url: str = Query(...),
    itag: Optional[int] = Query(None),
    subtype: str = Query("mp4"),
    token_file: Optional[str] = Depends(get_token_file),
):
    if itag:
        stream_info = get_stream_by_itag(url, itag, token_file=token_file)
    else:
        from pytubefix import YouTube
        import os
        tok = token_file
        if tok and not os.path.exists(tok):
            tok = None
        yt = YouTube(url, token_file=tok)
        yt.check_availability()
        stream = yt.streams.get_audio_only(subtype=subtype)
        if not stream:
            stream = yt.streams.filter(only_audio=True).order_by("abr").last()
        if not stream:
            raise HTTPException(status_code=404, detail="No audio stream found.")
        from app.services.youtube_service import _stream_to_schema
        stream_info = _stream_to_schema(stream)

    if not stream_info:
        raise HTTPException(status_code=404, detail="Audio stream not found.")

    media_url = stream_info.url
    content_type = stream_info.mime_type or "audio/mp4"
    ext = "m4a" if "mp4" in stream_info.subtype else stream_info.subtype

    def iter_audio():
        try:
            req = urllib.request.urlopen(media_url, timeout=settings.STREAM_TIMEOUT)
            while True:
                chunk = req.read(settings.CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
        except Exception as e:
            logger.error("Audio stream error: %s", e)

    headers = {
        "Content-Disposition": f'attachment; filename="audio_{stream_info.itag}.{ext}"',
        "Accept-Ranges": "bytes",
    }
    if stream_info.filesize:
        headers["Content-Length"] = str(stream_info.filesize)

    return StreamingResponse(iter_audio(), media_type=content_type, headers=headers)
