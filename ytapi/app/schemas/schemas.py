"""
Pydantic response & request schemas.

All schemas use snake_case field names and include rich OpenAPI examples.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


# ===========================================================================
# Shared / Primitive schemas
# ===========================================================================

class ErrorDetail(BaseModel):
    code: str
    message: str
    detail: Optional[str] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


# ===========================================================================
# Token management
# ===========================================================================

class TokenUploadResponse(BaseModel):
    success: bool
    message: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "message": "tokens.json updated successfully",
            }
        }
    }


class TokenStatusResponse(BaseModel):
    exists: bool
    valid: bool
    size: Optional[int] = None
    last_updated: Optional[str] = None
    ready: bool

    model_config = {
        "json_schema_extra": {
            "example": {
                "exists": True,
                "valid": True,
                "size": 2048,
                "last_updated": "2026-05-14T12:30:00",
                "ready": True,
            }
        }
    }


# ===========================================================================
# Thumbnail
# ===========================================================================

class ThumbnailInfo(BaseModel):
    url: str
    width: Optional[int] = None
    height: Optional[int] = None


# ===========================================================================
# Chapter / KeyMoment
# ===========================================================================

class ChapterInfo(BaseModel):
    title: str
    start_seconds: int
    duration: int


class KeyMomentInfo(BaseModel):
    title: str
    start_seconds: int
    duration: int


class HeatmapEntry(BaseModel):
    start_seconds: float
    duration: float
    norm_intensity: float


# ===========================================================================
# Caption
# ===========================================================================

class CaptionInfo(BaseModel):
    code: str
    name: str
    url: Optional[str] = None
    is_auto_generated: bool = False


class CaptionsListResponse(BaseModel):
    video_id: str
    total: int
    captions: List[CaptionInfo]


class CaptionDownloadResponse(BaseModel):
    video_id: str
    language_code: str
    format: str
    content: str


# ===========================================================================
# Stream
# ===========================================================================

class StreamInfo(BaseModel):
    itag: int
    mime_type: str
    type: str
    subtype: str
    codecs: List[str]
    video_codec: Optional[str] = None
    audio_codec: Optional[str] = None
    resolution: Optional[str] = None
    fps: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    bitrate: Optional[int] = None
    abr: Optional[str] = None
    filesize: Optional[int] = None
    filesize_kb: Optional[float] = None
    filesize_mb: Optional[float] = None
    is_progressive: bool
    is_adaptive: bool
    is_dash: bool
    is_hdr: bool
    is_3d: bool
    is_live: bool
    is_otf: bool
    is_sabr: bool
    is_drc: bool
    includes_audio_track: bool
    includes_video_track: bool
    is_default_audio_track: bool
    includes_multiple_audio_tracks: bool
    audio_track_name: Optional[str] = None
    audio_track_name_regionalized: Optional[str] = None
    audio_track_language_id: Optional[str] = None
    url: str
    expiration: Optional[str] = None
    duration_ms: Optional[str] = None
    last_modified: Optional[str] = None


class StreamsResponse(BaseModel):
    video_id: str
    title: str
    total: int
    progressive: List[StreamInfo]
    adaptive: List[StreamInfo]
    audio_only: List[StreamInfo]
    video_only: List[StreamInfo]
    all_streams: List[StreamInfo]


# ===========================================================================
# Video info
# ===========================================================================

class VideoInfoResponse(BaseModel):
    video_id: str
    title: str
    original_title: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    channel_id: Optional[str] = None
    channel_url: Optional[str] = None
    length_seconds: Optional[int] = None
    views: Optional[int] = None
    rating: Optional[float] = None
    likes: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    publish_date: Optional[str] = None
    watch_url: str
    embed_url: str
    thumbnail_url: Optional[str] = None
    thumbnails: List[ThumbnailInfo] = Field(default_factory=list)
    is_age_restricted: bool
    is_live: bool = False
    is_shorts: bool = False
    chapters: List[ChapterInfo] = Field(default_factory=list)
    key_moments: List[KeyMomentInfo] = Field(default_factory=list)
    heatmap: List[HeatmapEntry] = Field(default_factory=list)
    captions_available: bool
    caption_languages: List[str] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None
    availability: str = "available"
    stream_count: int = 0


# ===========================================================================
# Audio
# ===========================================================================

class AudioStreamsResponse(BaseModel):
    video_id: str
    total: int
    streams: List[StreamInfo]
    best: Optional[StreamInfo] = None


# ===========================================================================
# Thumbnails
# ===========================================================================

class ThumbnailsResponse(BaseModel):
    video_id: str
    thumbnail_url: str
    all_thumbnails: List[ThumbnailInfo]


# ===========================================================================
# Playlist
# ===========================================================================

class PlaylistVideoSummary(BaseModel):
    url: str
    video_id: str
    title: Optional[str] = None


class PlaylistInfoResponse(BaseModel):
    playlist_id: str
    playlist_url: str
    title: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None
    owner_id: Optional[str] = None
    owner_url: Optional[str] = None
    length: Optional[int] = None
    views: Optional[int] = None
    last_updated: Optional[str] = None
    thumbnail_url: Optional[str] = None


class PlaylistVideosResponse(BaseModel):
    playlist_id: str
    total: int
    page: int
    page_size: int
    videos: List[PlaylistVideoSummary]


# ===========================================================================
# Search
# ===========================================================================

class SearchVideoResult(BaseModel):
    video_id: str
    url: str
    title: Optional[str] = None
    author: Optional[str] = None
    result_type: str = "video"   # video | short | playlist | channel


class SearchResponse(BaseModel):
    query: str
    total: int
    videos: List[SearchVideoResult]
    shorts: List[SearchVideoResult]
    playlists: List[SearchVideoResult]
    channels: List[SearchVideoResult]
    suggestions: List[str] = Field(default_factory=list)


# ===========================================================================
# Shorts
# ===========================================================================

class ShortsInfoResponse(BaseModel):
    video_id: str
    is_shorts: bool
    title: Optional[str] = None
    author: Optional[str] = None
    length_seconds: Optional[int] = None
    views: Optional[int] = None
    thumbnail_url: Optional[str] = None
    watch_url: str
    streams: List[StreamInfo] = Field(default_factory=list)


# ===========================================================================
# Health
# ===========================================================================

class HealthResponse(BaseModel):
    status: str
    version: str
    token_ready: bool
    download_dir: str
    uptime_seconds: float
