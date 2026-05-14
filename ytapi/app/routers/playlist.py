"""
Playlist endpoints.

GET  /playlist/info    — metadata
GET  /playlist/videos  — paginated video list
POST /playlist/download — batch download preparation (returns stream URLs)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.dependencies import get_token_file
from app.schemas.schemas import PlaylistInfoResponse, PlaylistVideosResponse
from app.services.playlist_service import get_playlist_info, get_playlist_videos

router = APIRouter(tags=["Playlist"])


@router.get(
    "/playlist/info",
    response_model=PlaylistInfoResponse,
    summary="Get playlist metadata",
)
async def playlist_info(
    url: str = Query(..., description="YouTube playlist URL"),
):
    try:
        return get_playlist_info(url)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get(
    "/playlist/videos",
    response_model=PlaylistVideosResponse,
    summary="List videos in a playlist (paginated)",
)
async def playlist_videos(
    url: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    try:
        return get_playlist_videos(url, page=page, page_size=page_size)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post(
    "/playlist/download",
    summary="Prepare batch download (returns stream URLs for all videos)",
    description=(
        "Returns the best stream URL for every video in the playlist. "
        "Useful for orchestrating parallel downloads on the client side."
    ),
)
async def playlist_download(
    url: str = Query(...),
    progressive: bool = Query(True),
    token_file: Optional[str] = Depends(get_token_file),
):
    from app.services.youtube_service import get_best_stream
    try:
        videos_resp = get_playlist_videos(url, page=1, page_size=500)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    items = []
    for v in videos_resp.videos:
        try:
            stream = get_best_stream(v.url, token_file=token_file, progressive=progressive)
            items.append({
                "video_id": v.video_id,
                "url": v.url,
                "stream_url": stream.url if stream else None,
                "itag": stream.itag if stream else None,
                "resolution": stream.resolution if stream else None,
                "filesize": stream.filesize if stream else None,
            })
        except Exception as e:
            items.append({"video_id": v.video_id, "url": v.url, "error": str(e)})

    return {"playlist_id": videos_resp.playlist_id, "total": len(items), "items": items}
