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


def get_playlist_videos(url: str, page: int = 1, page_size: int = 50) -> PlaylistVideosResponse:
    pl = Playlist(url, token_file=_tok())
    all_urls: List[str] = list(pl.video_urls)
    start = (page - 1) * page_size
    end = start + page_size
    page_urls = all_urls[start:end]

    videos = []
    for vu in page_urls:
        from pytubefix import extract as _ext
        try:
            vid = _ext.video_id(vu)
        except Exception:
            vid = ""
        videos.append(PlaylistVideoSummary(url=vu, video_id=vid))

    return PlaylistVideosResponse(
        playlist_id=pl.playlist_id,
        total=len(all_urls),
        page=page,
        page_size=page_size,
        videos=videos,
    )


def _yt_to_result(yt_obj, result_type: str = "video") -> SearchVideoResult:
    try:
        url = yt_obj.watch_url
    except Exception:
        url = getattr(yt_obj, "playlist_url", getattr(yt_obj, "channel_url", ""))
    try:
        vid = yt_obj.video_id
    except Exception:
        vid = getattr(yt_obj, "playlist_id", getattr(yt_obj, "channel_id", ""))

    title: Optional[str] = None
    try:
        title = yt_obj.title
    except Exception:
        pass

    author: Optional[str] = None
    try:
        author = yt_obj.author
    except Exception:
        try:
            author = yt_obj.owner
        except Exception:
            try:
                author = yt_obj.channel_name
            except Exception:
                pass

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
