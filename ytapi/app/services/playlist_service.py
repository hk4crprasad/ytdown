"""
Playlist & Search service layer.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from pytubefix import Playlist, Search
from pytubefix.contrib.search import Filter

from app.core.config import settings
from app.schemas.schemas import (
    PlaylistInfoResponse, PlaylistVideosResponse, PlaylistVideoSummary,
    SearchResponse, SearchVideoResult,
)

logger = logging.getLogger(__name__)


def _tok() -> Optional[str]:
    import os
    p = settings.TOKEN_FILE
    return p if os.path.exists(p) else None


def get_playlist_info(url: str) -> PlaylistInfoResponse:
    pl = Playlist(url, token_file=_tok())
    last_up: Optional[str] = None
    try:
        lu = pl.last_updated
        last_up = str(lu) if lu else None
    except Exception:
        pass

    views: Optional[int] = None
    try:
        views = pl.views
    except Exception:
        pass

    length: Optional[int] = None
    try:
        length = pl.length
    except Exception:
        pass

    desc: Optional[str] = None
    try:
        desc = pl.description
    except Exception:
        pass

    thumb: Optional[str] = None
    try:
        thumb = pl.thumbnail_url
    except Exception:
        pass

    owner: Optional[str] = None
    owner_id: Optional[str] = None
    owner_url: Optional[str] = None
    try:
        owner = pl.owner
        owner_id = pl.owner_id
        owner_url = pl.owner_url
    except Exception:
        pass

    return PlaylistInfoResponse(
        playlist_id=pl.playlist_id,
        playlist_url=pl.playlist_url,
        title=pl.title,
        description=desc,
        owner=owner,
        owner_id=owner_id,
        owner_url=owner_url,
        length=length,
        views=views,
        last_updated=last_up,
        thumbnail_url=thumb,
    )


def _extract_playlist_videos(pl) -> List[PlaylistVideoSummary]:
    """
    Parse the playlist's already-fetched initial_data to get (video_id, url, title)
    triples without making any additional HTTP requests.
    Falls back to video_urls-only if initial_data parsing fails.
    """
    results: List[PlaylistVideoSummary] = []

    def _walk(obj):
        if isinstance(obj, dict):
            if "playlistVideoRenderer" in obj:
                r = obj["playlistVideoRenderer"]
                vid = r.get("videoId", "")
                if not vid:
                    return
                title: Optional[str] = None
                try:
                    title = r["title"]["runs"][0]["text"]
                except (KeyError, IndexError, TypeError):
                    try:
                        title = r["title"]["simpleText"]
                    except (KeyError, TypeError):
                        pass
                results.append(PlaylistVideoSummary(
                    url=f"https://www.youtube.com/watch?v={vid}",
                    video_id=vid,
                    title=title,
                ))
            else:
                for v in obj.values():
                    _walk(v)
        elif isinstance(obj, list):
            for item in obj:
                _walk(item)

    try:
        _walk(pl.initial_data)
    except Exception:
        pass

    if not results:
        # Fallback: use video_urls without titles
        from pytubefix import extract as _ext
        for vu in pl.video_urls:
            try:
                vid = _ext.video_id(vu)
            except Exception:
                vid = ""
            results.append(PlaylistVideoSummary(url=vu, video_id=vid))

    return results


def get_playlist_videos(url: str, page: int = 1, page_size: int = 50) -> PlaylistVideosResponse:
    pl = Playlist(url, token_file=_tok())
    all_videos = _extract_playlist_videos(pl)
    start = (page - 1) * page_size
    end = start + page_size
    page_videos = all_videos[start:end]

    return PlaylistVideosResponse(
        playlist_id=pl.playlist_id,
        total=len(all_videos),
        page=page,
        page_size=page_size,
        videos=page_videos,
    )


def _safe_get(obj, *attrs):
    """Try each attribute in order; catches ALL exceptions, not just AttributeError."""
    for attr in attrs:
        try:
            val = getattr(obj, attr)
            if val:
                return val
        except Exception:
            continue
    return ""


def _yt_to_result(yt_obj, result_type: str = "video") -> SearchVideoResult:
    """
    Convert a pytubefix search result object to SearchVideoResult.
    Uses type-specific attribute access — generic fallback chains cause cross-type
    property errors (e.g. Channel.playlist_url raises KeyError, not AttributeError).
    """
    if result_type == "channel":
        url = _safe_get(yt_obj, "channel_url")
        vid = _safe_get(yt_obj, "channel_id")
    elif result_type == "playlist":
        url = _safe_get(yt_obj, "playlist_url")
        vid = _safe_get(yt_obj, "playlist_id")
    else:
        # video or short
        url = _safe_get(yt_obj, "watch_url")
        vid = _safe_get(yt_obj, "video_id")

    title  = _safe_get(yt_obj, "title", "name") or None
    author = _safe_get(yt_obj, "author", "owner", "channel_name") or None

    return SearchVideoResult(
        video_id=vid,
        url=url,
        title=title,
        author=author,
        result_type=result_type,
    )


def search_youtube(
    query: str,
    result_type: Optional[str] = None,
    upload_date: Optional[str] = None,
    duration: Optional[str] = None,
    sort_by: Optional[str] = None,
    page: int = 1,
) -> SearchResponse:
    """Search YouTube using pytubefix Search + Filter."""

    filters: Optional[Filter] = None
    if any([result_type, upload_date, duration, sort_by]):
        f = Filter.create()
        if result_type:
            type_map = {
                "video": Filter.Type.VIDEO,
                "channel": Filter.Type.CHANNEL,
                "playlist": Filter.Type.PLAYLIST,
                "movie": Filter.Type.MOVIE,
            }
            t = type_map.get(result_type.lower())
            if t:
                f.type(t)
        if upload_date:
            ud_map = {
                "hour": Filter.UploadDate.LAST_HOUR,
                "today": Filter.UploadDate.TODAY,
                "week": Filter.UploadDate.THIS_WEEK,
                "month": Filter.UploadDate.THIS_MONTH,
                "year": Filter.UploadDate.THIS_YEAR,
            }
            ud = ud_map.get(upload_date.lower())
            if ud:
                f.upload_date(ud)
        if duration:
            dur_map = {
                "short": Filter.Duration.UNDER_4_MINUTES,
                "long": Filter.Duration.OVER_20_MINUTES,
                "medium": Filter.Duration.BETWEEN_4_20_MINUTES,
            }
            d = dur_map.get(duration.lower())
            if d:
                f.duration(d)
        if sort_by:
            sb_map = {
                "relevance": Filter.SortBy.RELEVANCE,
                "date": Filter.SortBy.UPLOAD_DATE,
                "views": Filter.SortBy.VIEW_COUNT,
                "rating": Filter.SortBy.RATING,
            }
            s = sb_map.get(sort_by.lower())
            if s:
                f.sort_by(s)
        filters = f

    s = Search(query, token_file=_tok(), filters=filters)

    # Paginate
    for _ in range(page - 1):
        s.get_next_results()

    videos = [_yt_to_result(v, "video") for v in s.videos]
    shorts = [_yt_to_result(v, "short") for v in s.shorts]
    playlists = [_yt_to_result(p, "playlist") for p in s.playlist]
    channels = [_yt_to_result(c, "channel") for c in s.channel]

    suggestions: List[str] = []
    try:
        suggestions = s.completion_suggestions or []
    except Exception:
        pass

    return SearchResponse(
        query=query,
        total=len(videos) + len(shorts) + len(playlists) + len(channels),
        videos=videos,
        shorts=shorts,
        playlists=playlists,
        channels=channels,
        suggestions=suggestions,
    )
