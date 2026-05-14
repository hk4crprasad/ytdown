"""
Entry point — run with:
  python main.py
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
import uvicorn

from app import app  # noqa: F401  (re-exported for uvicorn)
from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
