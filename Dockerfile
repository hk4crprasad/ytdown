# ╔══════════════════════════════════════════════════════════════════╗
# ║  Stage 1 – Frontend builder (Next.js → standalone output)       ║
# ╚══════════════════════════════════════════════════════════════════╝
FROM node:22-alpine AS frontend-builder

WORKDIR /frontend

# Install dependencies (leverage Docker layer cache)
COPY New/package.json New/package-lock.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY New/ ./
RUN npm run build

# ╔══════════════════════════════════════════════════════════════════╗
# ║  Stage 2 – Python runtime (FastAPI + serves frontend)           ║
# ╚══════════════════════════════════════════════════════════════════╝
FROM python:3.12-slim AS runtime

LABEL maintainer="ytapi"
LABEL description="YTApi — FastAPI backend + Next.js frontend (standalone)"

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ──────────────────────────────────────────
COPY ytapi/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ── Backend source ───────────────────────────────────────────────
COPY ytapi/ ./

# ── Frontend standalone output ───────────────────────────────────
# Next.js 'standalone' output: .next/standalone + .next/static + public/
COPY --from=frontend-builder /frontend/.next/standalone    ./frontend/
COPY --from=frontend-builder /frontend/.next/static        ./frontend/.next/static/
COPY --from=frontend-builder /frontend/public              ./frontend/public/

# Runtime directories
RUN mkdir -p /app/downloads /app/temp /app/logs /app/token_backups

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start uvicorn – the FastAPI app mounts the frontend at '/'
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
