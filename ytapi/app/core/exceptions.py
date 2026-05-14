"""
Global FastAPI exception handlers.

Maps pytubefix exceptions → structured HTTP responses so every router
automatically returns consistent JSON errors without try/except boilerplate.
"""
import logging
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

from pytubefix.exceptions import (
    VideoUnavailable,
    VideoPrivate,
    VideoRegionBlocked,
    AgeRestrictedError,
    AgeCheckRequiredError,
    AgeCheckRequiredAccountError,
    MembersOnly,
    LiveStreamError,
    LiveStreamOffline,
    LiveStreamEnded,
    RecordingUnavailable,
    LoginRequired,
    BotDetection,
    VideoRemovedByUploader,
    VideoBlockedByCopyright,
    VideoRemovedByYouTubeForViolatingTOS,
    AccountTerminated,
    InnerTubeResponseError,
    UnknownVideoError,
    RegexMatchError,
    ExtractError,
    PytubeFixError,
)

logger = logging.getLogger(__name__)


def _json(status: int, code: str, message: str, detail: Any = None) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message}}
    if detail:
        body["error"]["detail"] = detail
    return JSONResponse(status_code=status, content=body)


async def video_unavailable_handler(request: Request, exc: VideoPrivate) -> JSONResponse:
    logger.warning("Video unavailable: %s | path=%s", exc, request.url)
    if isinstance(exc, VideoPrivate):
        return _json(403, "VIDEO_PRIVATE", "This video is private.")
    if isinstance(exc, MembersOnly):
        return _json(403, "MEMBERS_ONLY", "Members-only content.")
    if isinstance(exc, VideoRegionBlocked):
        return _json(451, "REGION_BLOCKED", "Not available in your region.")
    if isinstance(exc, VideoBlockedByCopyright):
        return _json(451, "COPYRIGHT_BLOCK", str(exc))
    if isinstance(exc, VideoRemovedByUploader):
        return _json(410, "REMOVED_BY_UPLOADER", str(exc))
    if isinstance(exc, VideoRemovedByYouTubeForViolatingTOS):
        return _json(410, "TOS_VIOLATION", str(exc))
    if isinstance(exc, AccountTerminated):
        return _json(410, "ACCOUNT_TERMINATED", str(exc))
    if isinstance(exc, AgeRestrictedError):
        return _json(403, "AGE_RESTRICTED", "Age-restricted – requires OAuth.")
    if isinstance(exc, AgeCheckRequiredError):
        return _json(403, "AGE_CHECK_REQUIRED", "Age check required.")
    if isinstance(exc, AgeCheckRequiredAccountError):
        return _json(403, "AGE_CHECK_ACCOUNT", "Sign in with your primary account.")
    if isinstance(exc, LoginRequired):
        return _json(401, "LOGIN_REQUIRED", str(exc))
    if isinstance(exc, BotDetection):
        return _json(429, "BOT_DETECTED", "Request identified as bot. Use OAuth/tokens.")
    if isinstance(exc, LiveStreamError):
        return _json(422, "LIVE_STREAM", "Live streams cannot be downloaded.")
    if isinstance(exc, LiveStreamOffline):
        return _json(422, "LIVE_OFFLINE", str(exc))
    if isinstance(exc, LiveStreamEnded):
        return _json(410, "LIVE_ENDED", str(exc))
    if isinstance(exc, RecordingUnavailable):
        return _json(410, "RECORDING_UNAVAILABLE", "Live stream recording unavailable.")
    if isinstance(exc, InnerTubeResponseError):
        return _json(502, "INNERTUBE_ERROR", "YouTube API did not respond.")
    if isinstance(exc, UnknownVideoError):
        return _json(500, "UNKNOWN_VIDEO_ERROR", str(exc))
    # generic
    return _json(422, "VIDEO_UNAVAILABLE", str(exc))


async def extract_error_handler(request: Request, exc: ExtractError) -> JSONResponse:
    logger.error("Extract error: %s | path=%s", exc, request.url)
    return _json(500, "EXTRACT_ERROR", "Data extraction failed.", str(exc))


async def regex_error_handler(request: Request, exc: RegexMatchError) -> JSONResponse:
    logger.error("Regex error: %s | path=%s", exc, request.url)
    return _json(500, "REGEX_ERROR", "Pattern matching failed.", str(exc))


async def pytubefix_error_handler(request: Request, exc: PytubeFixError) -> JSONResponse:
    logger.error("PytubeFixError: %s | path=%s", exc, request.url)
    return _json(500, "PYTUBEFIX_ERROR", str(exc))


async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception | path=%s", request.url)
    return _json(500, "INTERNAL_ERROR", "An unexpected error occurred.")


def register_handlers(app: Any) -> None:
    """Register all exception handlers on the FastAPI application."""
    # Order matters: most specific first (subclasses before base class)
    app.add_exception_handler(VideoPrivate, video_unavailable_handler)
    app.add_exception_handler(MembersOnly, video_unavailable_handler)
    app.add_exception_handler(VideoRegionBlocked, video_unavailable_handler)
    app.add_exception_handler(VideoBlockedByCopyright, video_unavailable_handler)
    app.add_exception_handler(VideoRemovedByUploader, video_unavailable_handler)
    app.add_exception_handler(VideoRemovedByYouTubeForViolatingTOS, video_unavailable_handler)
    app.add_exception_handler(AccountTerminated, video_unavailable_handler)
    app.add_exception_handler(AgeRestrictedError, video_unavailable_handler)
    app.add_exception_handler(AgeCheckRequiredError, video_unavailable_handler)
    app.add_exception_handler(AgeCheckRequiredAccountError, video_unavailable_handler)
    app.add_exception_handler(LoginRequired, video_unavailable_handler)
    app.add_exception_handler(BotDetection, video_unavailable_handler)
    app.add_exception_handler(LiveStreamError, video_unavailable_handler)
    app.add_exception_handler(LiveStreamOffline, video_unavailable_handler)
    app.add_exception_handler(LiveStreamEnded, video_unavailable_handler)
    app.add_exception_handler(RecordingUnavailable, video_unavailable_handler)
    app.add_exception_handler(InnerTubeResponseError, video_unavailable_handler)
    app.add_exception_handler(UnknownVideoError, video_unavailable_handler)
    app.add_exception_handler(VideoUnavailable, video_unavailable_handler)
    app.add_exception_handler(RegexMatchError, regex_error_handler)
    app.add_exception_handler(ExtractError, extract_error_handler)
    app.add_exception_handler(PytubeFixError, pytubefix_error_handler)
    app.add_exception_handler(Exception, generic_error_handler)
