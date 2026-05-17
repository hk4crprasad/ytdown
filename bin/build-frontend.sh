#!/usr/bin/env bash
# bin/build-frontend.sh
# Called by the root package.json heroku-postbuild hook.
# Builds the Next.js app in New/ and copies the standalone output to /app/frontend/
# so the FastAPI backend can serve it at runtime.
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_SRC="$ROOT_DIR/New"
FRONTEND_DEST="$ROOT_DIR/frontend"

echo "-----> Building Next.js frontend"

cd "$FRONTEND_SRC"
npm ci --prefer-offline
npm run build

echo "-----> Copying standalone output to $FRONTEND_DEST"

# Next.js standalone: copy the minimal server runtime
mkdir -p "$FRONTEND_DEST"
cp -r .next/standalone/. "$FRONTEND_DEST/"

# .next/static must live INSIDE the standalone dir for Next.js asset routing
mkdir -p "$FRONTEND_DEST/.next"
cp -r .next/static "$FRONTEND_DEST/.next/static"

# public/ is served as-is (images, icons, etc.)
if [ -d public ]; then
    cp -r public "$FRONTEND_DEST/public"
fi

echo "-----> Frontend build complete → $FRONTEND_DEST"
