#!/usr/bin/env bash
# Heroku web dyno startup script.
#
# What it does:
#   1. Writes tokens.json from the TOKENS_JSON config var (avoids committing secrets)
#   2. Puts the static ffmpeg binary on PATH
#   3. Sets FRONTEND_DIR so FastAPI serves the built Next.js output
#   4. Starts uvicorn on Heroku's dynamic $PORT

set -e

# ── 1. OAuth tokens ──────────────────────────────────────────────────────────
# On Heroku, tokens.json is NOT committed (it's in .gitignore).
# Store the full JSON content as the TOKENS_JSON config var:
#   heroku config:set TOKENS_JSON="$(cat ytapi/tokens.json)"
# This script writes it to disk before uvicorn starts.

TOKEN_PATH="/app/ytapi/tokens.json"

if [ -n "$TOKENS_JSON" ]; then
    echo "-----> Writing tokens.json from TOKENS_JSON config var"
    echo "$TOKENS_JSON" > "$TOKEN_PATH"
    echo "       Tokens written to $TOKEN_PATH"
elif [ -f "$TOKEN_PATH" ]; then
    echo "-----> tokens.json already present at $TOKEN_PATH"
else
    echo "WARNING: TOKENS_JSON env var not set and tokens.json not found."
    echo "         Pytubefix will run unauthenticated — YouTube may block requests."
fi

# ── 2. ffmpeg (installed by bin/post_compile) ────────────────────────────────
export PATH="/app/.heroku/ffmpeg:$PATH"

# ── 3. Frontend dir (built by bin/post_compile) ──────────────────────────────
export FRONTEND_DIR="/app/frontend"

# ── 4. Runtime directories ───────────────────────────────────────────────────
mkdir -p /app/ytapi/downloads /app/ytapi/temp /app/ytapi/logs /app/ytapi/token_backups

# ── 5. Diagnostics ───────────────────────────────────────────────────────────
echo "ffmpeg : $(ffmpeg -version 2>&1 | head -1 || echo 'not found')"
echo "tokens : $([ -f "$TOKEN_PATH" ] && echo 'present' || echo 'MISSING')"
echo "Starting uvicorn on port ${PORT:-8000}..."

# ── 6. Start server ──────────────────────────────────────────────────────────
cd /app/ytapi
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers 2 \
    --log-level info
