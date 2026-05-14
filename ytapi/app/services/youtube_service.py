"""
YouTube service layer — wraps pytubefix YouTube object.
Provides all metadata, stream, caption, chapter, and thumbnail extraction.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from pytubefix import YouTube
from pytubefix.exceptions import PytubeFixError

from app.core.config import settings
from app.schemas.schemas import (
    StreamInfo, VideoInfoResponse, ThumbnailInfo,
    ChapterInfo, KeyMomentInfo, HeatmapEntry, CaptionInfo,
)

logger = logging.getLogger(__name__)


def _yt(url: str, token_file: Optional[str] = None) -> YouTube:
    """Construct a YouTube instance with the global token_file."""
    tok = token_file or settings.TOKEN_FILE
    import os
    if not os.path.exists(tok):
        tok = None
    return YouTube(url, token_file=tok)


def _stream_to_schema(stream) -> StreamInfo:
    """Convert a pytubefix Stream object → StreamInfo schema."""
    expiration: Optional[str] = None
    try:
        expiration = stream.expiration.isoformat()
    except Exception:
        pass

    filesize: Optional[int] = None
    filesize_kb: Optional[float] = None
    filesize_mb: Optional[float] = None
    try:
        filesize = stream._filesize if stream._filesize else None
        filesize_kb = stream._filesize_kb if stream._filesize_kb else None
        filesize_mb = stream._filesize_mb if stream._filesize_mb else None
    except Exception:
        pass

    fps: Optional[int] = None
    try:
        fps = stream.fps
    except AttributeError:
        pass

    return StreamInfo(
        itag=stream.itag,
        mime_type=stream.mime_type,
        type=stream.type,
        subtype=stream.subtype,
        codecs=stream.codecs,
        video_codec=stream.video_codec,
        audio_codec=stream.audio_codec,
        resolution=stream.resolution,
        fps=fps,
        width=stream.width,
        height=stream.height,
        bitrate=stream.bitrate,
        abr=stream.abr,
        filesize=filesize,
        filesize_kb=filesize_kb,
        filesize_mb=filesize_mb,
        is_progressive=stream.is_progressive,
        is_adaptive=stream.is_adaptive,
        is_dash=stream.is_dash,
        is_hdr=stream.is_hdr,
        is_3d=stream.is_3d,
        is_live=stream.is_live,
        is_otf=stream.is_otf,
        is_sabr=stream.is_sabr,
        is_drc=stream.is_drc,
        includes_audio_track=stream.includes_audio_track,
        includes_video_track=stream.includes_video_track,
        is_default_audio_track=stream.is_default_audio_track,
        includes_multiple_audio_tracks=stream.includes_multiple_audio_tracks,
        audio_track_name=stream.audio_track_name,
        audio_track_name_regionalized=stream.audio_track_name_regionalized,
        audio_track_language_id=stream.audio_track_language_id,
        url=stream.url,
        expiration=expiration,
        duration_ms=stream.durationMs,
        last_modified=stream.last_Modified,
    )


def _detect_shorts(yt: YouTube) -> bool:
    """Heuristically detect YouTube Shorts."""
    try:
        return (
            "shorts" in yt.watch_url
            or (yt.length is not None and yt.length <= 60)
        )
    except Exception:
        return False


def _get_thumbnails(yt: YouTube) -> List[ThumbnailInfo]:
    """Extract all available thumbnail sizes."""
    try:
        thumbs = (
            yt.vid_info.get("videoDetails", {})
            .get("thumbnail", {})
            .get("thumbnails", [])
        )
        return [
            ThumbnailInfo(
                url=t.get("url", ""),
                width=t.get("width"),
                height=t.get("height"),
            )
            for t in thumbs
        ]
    except Exception:
        return [ThumbnailInfo(url=yt.thumbnail_url)]


def _get_chapters(yt: YouTube) -> List[ChapterInfo]:
    try:
        return [
            ChapterInfo(
                title=c.title,
                start_seconds=c.start_seconds,
                duration=c.duration,
            )
            for c in yt.chapters
        ]
    except Exception:
        return []


def _get_key_moments(yt: YouTube) -> List[KeyMomentInfo]:
    try:
        return [
            KeyMomentInfo(
                title=k.title,
                start_seconds=k.start_seconds,
                duration=k.duration,
            )
            for k in yt.key_moments
        ]
    except Exception:
        return []


def _get_heatmap(yt: YouTube) -> List[HeatmapEntry]:
    try:
        return [
            HeatmapEntry(
                start_seconds=h["start_seconds"],
                duration=h["duration"],
                norm_intensity=h["norm_intensity"],
            )
            for h in yt.replayed_heatmap
        ]
    except Exception:
        return []


def get_video_info(url: str, token_file: Optional[str] = None) -> VideoInfoResponse:
    """Extract complete video metadata."""
    yt = _yt(url, token_file)
    yt.check_availability()

    captions: List[CaptionInfo] = []
    caption_langs: List[str] = []
    try:
        for cap in yt.captions:
            captions.append(CaptionInfo(
                code=cap.code,
                name=cap.name,
                url=cap.url,
                is_auto_generated=cap.code.startswith("a."),
            ))
            caption_langs.append(cap.code)
    except Exception:
        pass

    metadata_dict: Optional[Dict[str, Any]] = None
    try:
        md = yt.metadata
        if md:
            metadata_dict = {row.get("title", ""): row.get("contents", "") for row in md.metadata}
    except Exception:
        pass

    publish_date_str: Optional[str] = None
    try:
        pd = yt.publish_date
        if pd:
            publish_date_str = pd.isoformat()
    except Exception:
        pass

    likes: Optional[str] = None
    try:
        likes = str(yt.likes)
    except Exception:
        pass

    views: Optional[int] = None
    try:
        views = yt.views
    except Exception:
        pass

    stream_count = 0
    try:
        stream_count = len(yt.streams)
    except Exception:
        pass

    return VideoInfoResponse(
        video_id=yt.video_id,
        title=yt.title,
        original_title=None,
        description=yt.description,
        author=yt.author,
        channel_id=yt.channel_id,
        channel_url=yt.channel_url,
        length_seconds=yt.length,
        views=views,
        rating=yt.rating,
        likes=likes,
        keywords=yt.keywords,
        publish_date=publish_date_str,
        watch_url=yt.watch_url,
        embed_url=yt.embed_url,
        thumbnail_url=yt.thumbnail_url,
        thumbnails=_get_thumbnails(yt),
        is_age_restricted=yt.age_restricted,
        is_shorts=_detect_shorts(yt),
        chapters=_get_chapters(yt),
        key_moments=_get_key_moments(yt),
        heatmap=_get_heatmap(yt),
        captions_available=len(captions) > 0,
        caption_languages=caption_langs,
        metadata=metadata_dict,
        availability="available",
        stream_count=stream_count,
    )


def get_all_streams(url: str, token_file: Optional[str] = None):
    """Return all stream categories for the video."""
    from app.schemas.schemas import StreamsResponse
    yt = _yt(url, token_file)
    yt.check_availability()
    streams = yt.streams

    all_s   = [_stream_to_schema(s) for s in streams]
    prog    = [_stream_to_schema(s) for s in streams.filter(progressive=True)]
    adapt   = [_stream_to_schema(s) for s in streams.filter(adaptive=True)]
    audio   = [_stream_to_schema(s) for s in streams.filter(only_audio=True)]
    video   = [_stream_to_schema(s) for s in streams.filter(only_video=True)]

    return StreamsResponse(
        video_id=yt.video_id,
        title=yt.title,
        total=len(all_s),
        progressive=prog,
        adaptive=adapt,
        audio_only=audio,
        video_only=video,
        all_streams=all_s,
    )


def get_best_stream(url: str, token_file: Optional[str] = None, progressive: bool = True):
    """Return the best quality stream."""
    yt = _yt(url, token_file)
    yt.check_availability()
    stream = yt.streams.get_highest_resolution(progressive=progressive)
    if not stream:
        stream = yt.streams.get_highest_resolution(progressive=False)
    return _stream_to_schema(stream) if stream else None


def get_stream_by_itag(url: str, itag: int, token_file: Optional[str] = None):
    yt = _yt(url, token_file)
    yt.check_availability()
    stream = yt.streams.get_by_itag(itag)
    return _stream_to_schema(stream) if stream else None


def get_audio_streams(url: str, token_file: Optional[str] = None):
    """Return all audio-only streams."""
    from app.schemas.schemas import AudioStreamsResponse
    yt = _yt(url, token_file)
    yt.check_availability()
    audio_streams = yt.streams.filter(only_audio=True).order_by("abr").fmt_streams
    best = yt.streams.get_audio_only()

    return AudioStreamsResponse(
        video_id=yt.video_id,
        total=len(audio_streams),
        streams=[_stream_to_schema(s) for s in audio_streams],
        best=_stream_to_schema(best) if best else None,
    )


def get_thumbnails(url: str, token_file: Optional[str] = None):
    from app.schemas.schemas import ThumbnailsResponse
    yt = _yt(url, token_file)
    return ThumbnailsResponse(
        video_id=yt.video_id,
        thumbnail_url=yt.thumbnail_url,
        all_thumbnails=_get_thumbnails(yt),
    )


def get_captions_list(url: str, token_file: Optional[str] = None):
    from app.schemas.schemas import CaptionsListResponse
    yt = _yt(url, token_file)
    caps = []
    try:
        for cap in yt.captions:
            caps.append(CaptionInfo(
                code=cap.code,
                name=cap.name,
                url=cap.url,
                is_auto_generated=cap.code.startswith("a."),
            ))
    except Exception as e:
        logger.warning("Caption fetch error: %s", e)

    return CaptionsListResponse(
        video_id=yt.video_id,
        total=len(caps),
        captions=caps,
    )


def get_caption_content(url: str, lang_code: str, fmt: str = "srt", token_file: Optional[str] = None):
    from app.schemas.schemas import CaptionDownloadResponse
    yt = _yt(url, token_file)
    captions = yt.captions

    cap = None
    for c in captions:
        if c.code == lang_code or c.code.strip(".") == lang_code.strip("."):
            cap = c
            break

    if not cap:
        return None

    if fmt == "srt":
        content = cap.generate_srt_captions()
    elif fmt == "txt":
        content = cap.generate_txt_captions()
    else:  # xml / vtt
        content = cap.xml_captions

    return CaptionDownloadResponse(
        video_id=yt.video_id,
        language_code=lang_code,
        format=fmt,
        content=content,
    )
