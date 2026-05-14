"""
FastAPI application factory.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_handlers
from app.core.logging_config import setup_logging
from app.middleware.logging_middleware import RequestLoggingMiddleware
from app.routers import audio, captions, health, merge, playlist, search, shorts, token, video

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

    return app


app = create_app()
