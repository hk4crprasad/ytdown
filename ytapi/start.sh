#!/usr/bin/env bash
# start.sh — Quick local startup script

set -e
cd "$(dirname "$0")"

echo "🚀 Starting YouTube Media Extraction API..."

# Copy .env if missing
if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    echo "📋 .env created from .env.example"
fi

# Install dependencies if missing
if ! python -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
fi

echo "✅ Starting uvicorn on http://0.0.0.0:8000"
echo "📚 Swagger UI: http://localhost:8000/docs"
echo "📖 ReDoc:      http://localhost:8000/redoc"
echo ""
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
