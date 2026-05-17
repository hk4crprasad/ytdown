"""
Search endpoint.

GET /search — YouTube search with filter support
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_token_file
from app.middleware.turnstile import verify_turnstile
from app.schemas.schemas import SearchResponse
from app.services.playlist_service import search_youtube

router = APIRouter(tags=["Search"], dependencies=[Depends(verify_turnstile)])



@router.get(
    "/search",
    response_model=SearchResponse,
    summary="Search YouTube",
    description=(
        "Search YouTube for videos, shorts, playlists, and channels. "
        "Supports type, duration, upload_date and sort_by filters. "
        "Use `page` for pagination."
    ),
)
async def search(
    q: str = Query(..., description="Search query string"),
    result_type: Optional[str] = Query(
        None,
        description="Filter by type: video | channel | playlist | movie",
    ),
    upload_date: Optional[str] = Query(
        None,
        description="Filter by upload date: hour | today | week | month | year",
    ),
    duration: Optional[str] = Query(
        None,
        description="Duration filter: short | medium | long",
    ),
    sort_by: Optional[str] = Query(
        None,
        description="Sort order: relevance | date | views | rating",
    ),
    page: int = Query(1, ge=1, description="Page number for pagination"),
):
    return search_youtube(
        query=q,
        result_type=result_type,
        upload_date=upload_date,
        duration=duration,
        sort_by=sort_by,
        page=page,
    )
