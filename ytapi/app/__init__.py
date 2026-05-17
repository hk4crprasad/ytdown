"""
FastAPI application factory.
"""
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.exceptions import register_handlers
from app.core.logging_config import setup_logging
from app.middleware.logging_middleware import RequestLoggingMiddleware
from app.routers import audio, captions, health, merge, playlist, search, shorts, token, video

# Resolve the directory where the Next.js standalone server.js lives.
# In Docker this is /app/frontend; locally it may not exist (dev uses `npm run dev`).
_FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", "/app/frontend"))
_FRONTEND_STATIC = _FRONTEND_DIR / ".next" / "static"
_FRONTEND_PUBLIC = _FRONTEND_DIR / "public"

setup_logging()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_TITLE,
        description=settings.APP_DESCRIPTION,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        contact={"name": "YTApi", "email": "api@ytapi.io"},
        license_info={"name": "MIT"},
    )

    # ----- CORS -----
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )

    # ----- Access logging -----
    app.add_middleware(RequestLoggingMiddleware)

    # ----- Exception handlers -----
    register_handlers(app)

    # ----- Routers -----
    app.include_router(health.router)
    app.include_router(token.router)
    app.include_router(video.router)
    app.include_router(audio.router)
    app.include_router(captions.router)
    app.include_router(playlist.router)
    app.include_router(shorts.router)
    app.include_router(search.router)
    app.include_router(merge.router)

    # ----- Static frontend (Next.js standalone build) -----
    # Only mounted when the built assets exist (i.e., inside Docker).
    if _FRONTEND_STATIC.is_dir():
        app.mount(
            "/_next/static",
            StaticFiles(directory=str(_FRONTEND_STATIC)),
            name="next-static",
        )
    if _FRONTEND_PUBLIC.is_dir():
        app.mount(
            "/public",
            StaticFiles(directory=str(_FRONTEND_PUBLIC)),
            name="next-public",
        )

    # ----- SPA / Next.js page fallback -----
    # Forward all unmatched GET requests to Next.js's standalone server.
    # Next.js standalone builds include a lightweight Node server (server.js);
    # however, since we are serving from Python we use the pre-rendered HTML
    # at _FRONTEND_DIR/.next/server/app/index.html (or the root page).
    _frontend_index = _FRONTEND_DIR / ".next" / "server" / "app" / "index.html"

    if _frontend_index.is_file():
        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_frontend(request: Request, full_path: str) -> HTMLResponse:
            """Serve the Next.js pre-rendered frontend for all non-API routes."""
            # Let API and docs routes fall through normally
            _api_prefixes = ("/api", "/docs", "/redoc", "/openapi", "/health",
                             "/video", "/audio", "/captions", "/playlist",
                             "/search", "/shorts", "/token", "/merge")
            if full_path and any(full_path.startswith(p.lstrip("/")) for p in _api_prefixes):
                from fastapi import HTTPException
                raise HTTPException(status_code=404)

            # Try an exact page match, fall back to root index
            page_html = _FRONTEND_DIR / ".next" / "server" / "app" / full_path / "index.html"
            if page_html.is_file():
                return FileResponse(str(page_html), media_type="text/html")
            return FileResponse(str(_frontend_index), media_type="text/html")

    return app


app = create_app()
