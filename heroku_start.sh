#!/usr/bin/env bash
# Heroku web dyno startup script.
#
# What it does:
#   1. Puts the static ffmpeg binary (installed by bin/post_compile) on PATH
#   2. Sets FRONTEND_DIR so FastAPI knows where to find the built Next.js output
#   3. Changes into the ytapi/ sub-directory so Python imports work correctly
#   4. Starts uvicorn on Heroku's dynamic $PORT

set -e

# ffmpeg installed by bin/post_compile into .heroku/ffmpeg/
export PATH="/app/.heroku/ffmpeg:$PATH"

# FastAPI uses this to mount _next/static and serve pre-rendered pages
export FRONTEND_DIR="/app/frontend"

# Runtime data directories (may not exist on a fresh dyno)
mkdir -p /app/ytapi/downloads /app/ytapi/temp /app/ytapi/logs /app/ytapi/token_backups

echo "ffmpeg: $(ffmpeg -version 2>&1 | head -1 || echo 'not found')"
echo "Starting uvicorn on port ${PORT:-8000}..."

cd /app/ytapi
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers 2 \
    --log-level info
