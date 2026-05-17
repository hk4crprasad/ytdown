# YTApi — YouTube Media Extraction Platform

A production-grade FastAPI backend for YouTube media extraction, powered by `pytubefix` and `ffmpeg`.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Backend — ytapi](#backend--ytapi)
  - [Entry Point](#entry-point)
  - [Application Factory](#application-factory)
  - [Configuration](#configuration)
  - [Middleware](#middleware)
  - [Exception Handling](#exception-handling)
  - [Dependency Injection](#dependency-injection)
  - [Routers & Endpoints](#routers--endpoints)
  - [Services](#services)
  - [Schemas (Pydantic)](#schemas-pydantic)
  - [Runtime Directories](#runtime-directories)
  - [Environment Variables](#environment-variables)
- [Data Flow — End to End](#data-flow--end-to-end)
- [Running Locally](#running-locally)

---

## Project Structure

```
python/
├── ytapi/                   # Python FastAPI backend
│   ├── main.py              # Uvicorn entry point
│   ├── pyproject.toml       # Build system config (setuptools)
│   ├── uv.lock              # Locked dependency versions
│   ├── tokens.json          # OAuth token file (gitignored, user-supplied)
│   ├── token_backups/       # Auto-backup of previous token files
│   ├── downloads/           # Permanent download storage (reserved)
│   ├── temp/                # Temporary chunk files and merged outputs
│   ├── logs/                # Server log files
│   └── app/
│       ├── __init__.py      # Application factory (create_app)
│       ├── core/
│       │   ├── config.py    # Settings via pydantic-settings
│       │   ├── dependencies.py  # FastAPI Depends callables
│       │   ├── exceptions.py    # Global pytubefix → HTTP error mapping
│       │   └── logging_config.py
│       ├── middleware/
│       │   └── logging_middleware.py  # Per-request access log
│       ├── routers/
│       │   ├── health.py    # GET /health
│       │   ├── token.py     # POST /upload/token, GET /token/status
│       │   ├── video.py     # GET /video/*
│       │   ├── audio.py     # GET /audio/*
│       │   ├── captions.py  # GET /captions/*
│       │   ├── shorts.py    # GET /shorts/*
│       │   ├── playlist.py  # GET /playlist/*, POST /playlist/download
│       │   ├── search.py    # GET /search
│       │   └── merge.py     # POST /merge/start, GET /merge/progress/{id}, etc.
│       ├── services/
│       │   ├── youtube_service.py   # Core pytubefix wrappers
│       │   ├── playlist_service.py  # Playlist + search logic
│       │   ├── download_service.py  # Job registry + chunked downloader + ffmpeg
│       │   └── token_service.py     # Token file read/write/validate
│       └── schemas/
│           └── schemas.py   # All Pydantic request/response models
```

---

## Backend — ytapi

### Entry Point

**`ytapi/main.py`**

Starts the Uvicorn ASGI server. Reads host, port, debug, and log level from `Settings`. Can be launched directly (`python main.py`) or via uvicorn CLI:

```
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

### Application Factory

**`ytapi/app/__init__.py`** — `create_app()`

Builds the FastAPI instance and wires everything together in order:

1. Registers `CORSMiddleware` (wildcard origins by default, configurable via env).
2. Registers `RequestLoggingMiddleware` for access logs.
3. Registers all global exception handlers via `register_handlers()`.
4. Mounts all routers (health, token, video, audio, captions, playlist, shorts, search, merge).

The `app` singleton is exported at module level so uvicorn can import it directly.

---

### Configuration

**`ytapi/app/core/config.py`** — `Settings` (pydantic-settings `BaseSettings`)

All runtime configuration lives here. Values are loaded from environment variables or a `.env` file at the project root. Defaults make the server work out of the box.

| Setting | Default | Purpose |
|---|---|---|
| `APP_HOST` | `0.0.0.0` | Bind address |
| `APP_PORT` | `8000` | Bind port |
| `DEBUG` | `False` | Enables uvicorn `--reload` |
| `CORS_ORIGINS` | `["*"]` | Allowed CORS origins |
| `TOKEN_FILE` | `<root>/tokens.json` | Path to OAuth token file |
| `TOKEN_BACKUP_DIR` | `<root>/token_backups` | Auto-backup directory |
| `DOWNLOAD_DIR` | `<root>/downloads` | Permanent download storage |
| `TEMP_DIR` | `<root>/temp` | Temporary chunk + merge files |
| `LOG_DIR` | `<root>/logs` | Log file directory |
| `CHUNK_SIZE` | `524288` (512 KB) | Stream proxy chunk size |
| `MAX_DOWNLOAD_SIZE_MB` | `2048` | Guard limit |
| `STREAM_TIMEOUT` | `30` | HTTP stream timeout (s) |
| `DEFAULT_CLIENT` | `IOS` | pytubefix client type |
| `LOG_LEVEL` | `INFO` | Python logging level |

Critical directories (`DOWNLOAD_DIR`, `TEMP_DIR`, `LOG_DIR`, `TOKEN_BACKUP_DIR`) are created at import time if they don't exist.

---

### Middleware

**`ytapi/app/middleware/logging_middleware.py`** — `RequestLoggingMiddleware`

Starlette `BaseHTTPMiddleware` that logs every request: method, path, status code, and response time in milliseconds. Writes to the standard Python logger (`uvicorn.access` style).

---

### Exception Handling

**`ytapi/app/core/exceptions.py`** — `register_handlers()`

Maps every `pytubefix` exception to a structured JSON HTTP error — no `try/except` needed in routers. Response format:

```json
{
  "error": {
    "code": "VIDEO_PRIVATE",
    "message": "This video is private.",
    "detail": "..."
  }
}
```

Full mapping:

| Exception | HTTP Status | Code |
|---|---|---|
| `VideoPrivate` | 403 | `VIDEO_PRIVATE` |
| `MembersOnly` | 403 | `MEMBERS_ONLY` |
| `VideoRegionBlocked` | 451 | `REGION_BLOCKED` |
| `VideoBlockedByCopyright` | 451 | `COPYRIGHT_BLOCK` |
| `AgeRestrictedError` | 403 | `AGE_RESTRICTED` |
| `LoginRequired` | 401 | `LOGIN_REQUIRED` |
| `BotDetection` | 429 | `BOT_DETECTED` |
| `LiveStreamError` | 422 | `LIVE_STREAM` |
| `LiveStreamOffline` | 422 | `LIVE_OFFLINE` |
| `LiveStreamEnded` | 410 | `LIVE_ENDED` |
| `VideoRemovedByUploader` | 410 | `REMOVED_BY_UPLOADER` |
| `InnerTubeResponseError` | 502 | `INNERTUBE_ERROR` |
| `ExtractError` | 500 | `EXTRACT_ERROR` |
| `RegexMatchError` | 500 | `REGEX_ERROR` |
| `PytubeFixError` | 500 | `PYTUBEFIX_ERROR` |
| `Exception` (catch-all) | 500 | `INTERNAL_ERROR` |

---

### Dependency Injection

**`ytapi/app/core/dependencies.py`**

Two FastAPI `Depends` callables used across routers:

- **`get_token_file()`** — returns the path to `tokens.json` if the file exists; returns `None` otherwise. Endpoints using this dependency work in both authenticated and unauthenticated modes.
- **`require_token_file()`** — same but raises `HTTP 503 TOKEN_MISSING` when the file is absent (for future endpoints that strictly need OAuth).

---

### Routers & Endpoints

#### Health — `GET /health`

Returns API status, version, uptime, token readiness, and download directory path.

```json
{
  "status": "ok",
  "version": "1.0.0",
  "token_ready": true,
  "download_dir": "/path/to/downloads",
  "uptime_seconds": 3600.0
}
```

---

#### Token Management

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload/token` | Upload a `tokens.json` OAuth file. The old file is atomically backed up. Accepts `multipart/form-data`. |
| `GET` | `/token/status` | Returns `exists`, `valid`, `size`, `last_updated`, `ready` for the current token file. |

---

#### Video — `GET /video/*`

| Method | Path | Query Params | Description |
|---|---|---|---|
| `GET` | `/video/info` | `url` | Full video metadata: title, description, views, likes, author, channel, duration, publish date, keywords, thumbnails, chapters, key moments, heatmap, captions list, availability. |
| `GET` | `/video/streams` | `url`, `resolution`, `mime_type`, `only_audio`, `only_video`, `progressive`, `adaptive`, `is_dash`, `video_codec`, `audio_codec` | All streams with optional filtering. Returns categorized lists: progressive, adaptive, audio-only, video-only. |
| `GET` | `/video/best` | `url`, `progressive` | Best single stream info (highest resolution). |
| `GET` | `/video/download` | `url`, `itag` | Proxies video bytes directly to the HTTP client as a `StreamingResponse`. Uses 512 KB chunks. |
| `GET` | `/video/thumbnails` | `url` | All thumbnail URLs with dimensions. |

---

#### Audio — `GET /audio/*`

| Method | Path | Query Params | Description |
|---|---|---|---|
| `GET` | `/audio/streams` | `url`, `subtype` | All audio-only streams. Optional subtype filter (`mp4`, `webm`). |
| `GET` | `/audio/best` | `url`, `subtype` | Best audio stream (highest ABR). |
| `GET` | `/audio/download` | `url`, `itag`, `subtype` | Streams audio bytes directly to client as `.m4a`/`.webm`. |

---

#### Captions — `GET /captions/*`

| Method | Path | Query Params | Description |
|---|---|---|---|
| `GET` | `/captions/list` | `url` | Lists all caption tracks with language code, name, URL, and `is_auto_generated` flag. |
| `GET` | `/captions/download` | `url`, `lang_code`, `fmt`, `raw` | Downloads captions as `srt`, `txt`, or `xml`. `raw=true` returns plain text response. |

---

#### Shorts — `GET /shorts/*`

| Method | Path | Query Params | Description |
|---|---|---|---|
| `GET` | `/shorts/info` | `url` | Metadata + all streams for a YouTube Short (or regular video). Includes `is_shorts` detection. |
| `GET` | `/shorts/download` | `url` | Streams Short bytes to client (highest available resolution). |

---

#### Playlist

| Method | Path | Query Params | Description |
|---|---|---|---|
| `GET` | `/playlist/info` | `url` | Playlist metadata: title, description, owner, owner URL, video count, views, last updated, thumbnail. |
| `GET` | `/playlist/videos` | `url`, `page`, `page_size` | Paginated list of videos in a playlist. Each entry includes `video_id`, `url`, and `title`. Max `page_size` is 200. |
| `POST` | `/playlist/download` | `url`, `progressive` | Resolves the best stream URL for every video in the playlist and returns them as a batch. Useful for orchestrating parallel client-side downloads. |

---

#### Search — `GET /search`

| Query Param | Description |
|---|---|
| `q` | Search query (required) |
| `result_type` | Filter: `video`, `channel`, `playlist`, `movie` |
| `upload_date` | Filter: `hour`, `today`, `week`, `month`, `year` |
| `duration` | Filter: `short`, `medium`, `long` |
| `sort_by` | Order: `relevance`, `date`, `views`, `rating` |
| `page` | Pagination (1-indexed) |

Returns separate lists for `videos`, `shorts`, `playlists`, `channels`, plus `suggestions`.

---

#### Merge & Download (Job System) — `POST/GET /merge/*`

This is the core download pipeline for high-quality adaptive streams that need ffmpeg merging.

| Method | Path | Description |
|---|---|---|
| `POST` | `/merge/start` | Creates a download job. Resolves video + audio streams, then starts a background pipeline thread. Returns `job_id`. |
| `GET` | `/merge/progress/{job_id}` | **Server-Sent Events (SSE)** stream. Emits JSON progress events every 150ms while the job runs. |
| `GET` | `/merge/file/{job_id}` | Serves the finished merged `.mp4` file as a `FileResponse`. |
| `GET` | `/merge/options` | Lists all adaptive video streams + best audio stream for a URL (helper for UI quality selection). |
| `GET` | `/merge/jobs` | Returns snapshots of all active/completed jobs. |
| `DELETE` | `/merge/job/{job_id}` | Deletes the job record and its output file from disk. |

---

### Services

#### `youtube_service.py`

Core wrapper around `pytubefix.YouTube`. Functions:

- **`get_video_info(url, token_file)`** — builds a `VideoInfoResponse` with all metadata, chapters, key moments, heatmap, and caption language list.
- **`get_all_streams(url, token_file)`** — returns categorized `StreamsResponse`.
- **`get_best_stream(url, token_file, progressive)`** — returns highest-resolution `StreamInfo`.
- **`get_stream_by_itag(url, itag, token_file)`** — returns a specific stream by itag.
- **`get_audio_streams(url, token_file)`** — returns `AudioStreamsResponse` with best audio highlighted.
- **`get_thumbnails(url, token_file)`** — returns all thumbnail objects.
- **`get_captions_list(url, token_file)`** — lists caption tracks.
- **`get_caption_content(url, lang_code, fmt, token_file)`** — fetches and formats caption content as SRT/TXT/XML.
- **`_stream_to_schema(stream)`** — converts a `pytubefix.Stream` object to `StreamInfo` Pydantic model.
- **`_detect_shorts(yt)`** — heuristic to detect if a video is a Short (≤ 60s, square/portrait).

#### `playlist_service.py`

- **`get_playlist_info(url)`** — fetches `pytubefix.Playlist` metadata and returns `PlaylistInfoResponse`.
- **`get_playlist_videos(url, page, page_size)`** — paginates through playlist videos. Uses `_extract_playlist_videos()` to parse titles and IDs from `initial_data` without extra HTTP requests.
- **`_extract_playlist_videos(pl)`** — parses `pl.initial_data` JSON directly for video titles and IDs. Falls back to URL-only parsing if `initial_data` is unavailable.
- **`search_youtube(query, result_type, upload_date, duration, sort_by, page)`** — runs `pytubefix.Search` with filters and maps results to `SearchResponse`. Uses **type-aware** extraction:
  - `channel` → extracts `channel_url` and `channel_id`
  - `playlist` → extracts `playlist_url` and `playlist_id`
  - `video`/`short` → extracts `watch_url` and `video_id`
- **`_safe_get(obj, *attrs)`** — safely traverses nested attribute chains, catching all exceptions (including `KeyError` from pytubefix internals).

#### `download_service.py`

The full async-capable, multi-threaded download + ffmpeg merge pipeline.

**Job Lifecycle:**

```
queued → downloading → merging → done
                    ↘ error
```

**`DownloadJob` dataclass** — holds all state per job:
- Progress percentages: `video_pct`, `audio_pct`, `merge_pct`, `overall_pct`
- Byte counters: `video_bytes_done`, `video_bytes_total`, etc.
- Speed: `video_speed_mbps`, `audio_speed_mbps`
- Timing: `started_at`, `finished_at`, `eta_seconds`
- SSE event queue: `_events` (list of dicts, guarded by `threading.Lock`)
- Completion gate: `_done_event` (threading.Event)

**`multithreaded_download(url, output_path, n_threads, progress_cb)`:**
- Does a HEAD request to get `Content-Length`.
- Splits the file into N equal byte-range chunks.
- Downloads all chunks in parallel via `ThreadPoolExecutor` using HTTP `Range` headers.
- Assembles ordered chunks into the final file and cleans up `.tmp` files.
- Falls back to single-thread streaming if the server doesn't support Range requests or the file is small.
- Default: **8 threads** for video, **4 threads** for audio.

**`_run_pipeline(job, video_url, audio_url)`** (background thread):

1. **Phase 1 — Parallel download:** Spawns two threads — one for video (8 threads), one for audio (4 threads). Both run `multithreaded_download` concurrently. Overall progress = `video_pct × 0.4 + audio_pct × 0.4`.
2. **Phase 2 — FFmpeg merge:** Runs `ffmpeg -i video -i audio -c:v copy -c:a aac -b:a 192k -movflags +faststart`. Parses `ffprobe` duration and `ffmpeg -progress pipe:1` output to emit granular merge progress. Overall progress goes from 80% → 100% during this phase.
3. **Phase 3 — Done:** Sets `output_path`, `finished_at`, emits final SSE event with `download_url`.

For **progressive streams** (already contain audio), the merge phase is skipped and a direct 8-thread download is run instead.

**SSE event shape** (emitted to `/merge/progress/{job_id}`):

```json
{
  "job_id": "abc123def456",
  "title": "Video Title",
  "status": "downloading",
  "phase": "downloading",
  "video_pct": 45.2,
  "audio_pct": 72.1,
  "merge_pct": 0.0,
  "overall_pct": 47.0,
  "video_bytes_done": 47185920,
  "video_bytes_total": 104857600,
  "video_speed_mbps": 12.4,
  "audio_speed_mbps": 8.1,
  "video_res": "1080p",
  "video_codec": "avc1",
  "audio_codec": "mp4a",
  "audio_abr": "128kbps",
  "eta_seconds": 5,
  "error": null,
  "output_path": ""
}
```

When the job finishes, the final event also includes `"download_url": "/merge/file/{job_id}"` and `"_eof": true`.

#### `token_service.py`

- **`upload_token(content: bytes)`** — validates that the content is valid JSON, backs up the existing `tokens.json` to `token_backups/` with a timestamp, then atomically writes the new file.
- **`get_token_status()`** — returns `TokenStatusResponse` with `exists`, `valid`, `size`, `last_updated`, `ready`.

---

### Schemas (Pydantic)

All models are in `ytapi/app/schemas/schemas.py`. Key models:

| Model | Used By |
|---|---|
| `VideoInfoResponse` | `GET /video/info` |
| `StreamInfo` | All stream endpoints |
| `StreamsResponse` | `GET /video/streams` |
| `AudioStreamsResponse` | `GET /audio/streams` |
| `CaptionsListResponse` | `GET /captions/list` |
| `CaptionDownloadResponse` | `GET /captions/download` |
| `PlaylistInfoResponse` | `GET /playlist/info` |
| `PlaylistVideosResponse` | `GET /playlist/videos` |
| `PlaylistVideoSummary` | Item in playlist video list |
| `SearchResponse` | `GET /search` |
| `SearchVideoResult` | Item in search results |
| `ShortsInfoResponse` | `GET /shorts/info` |
| `TokenUploadResponse` | `POST /upload/token` |
| `TokenStatusResponse` | `GET /token/status` |
| `HealthResponse` | `GET /health` |
| `ErrorResponse` / `ErrorDetail` | All error responses |

---

### Runtime Directories

| Directory | Purpose |
|---|---|
| `ytapi/temp/` | Chunk `.tmp` files during parallel download; `out_<job_id>.mp4` merged files |
| `ytapi/downloads/` | Reserved for permanent storage (not yet used by any router) |
| `ytapi/logs/` | Application log files (`ytapi.log`) |
| `ytapi/token_backups/` | Timestamped backups of replaced `tokens.json` files |

---

### Environment Variables

Create a `.env` file in `ytapi/` to override any setting:

```env
APP_PORT=8000
DEBUG=true
LOG_LEVEL=DEBUG
DEFAULT_CLIENT=IOS
CORS_ORIGINS=["http://localhost:5173"]
```

---

## Data Flow — End to End

### Video Download (Adaptive / High Quality)

```
Client → GET /merge/options?url=...
       ← { video_streams: [...], auto_audio: {...} }

Client → POST /merge/start?url=...&itag=1234
       ← { job_id: "abc123def456" }

Client → GET /merge/progress/abc123def456   (SSE)
       ← events every 150ms:
           Phase 1: parallel 8-thread video + 4-thread audio download
           Phase 2: ffmpeg merge (video copy + aac 192k)
           Phase 3: { status: "done", download_url: "/merge/file/abc123def456" }

Client → GET /merge/file/abc123def456
       ← FileResponse (video.mp4)
```

### Search

```
Client → GET /search?q=python+tutorial&result_type=video&sort_by=views
       ← { videos: [...], shorts: [...], playlists: [...], channels: [...] }
```

### Playlist

```
Client → GET /playlist/info?url=...   ← metadata
Client → GET /playlist/videos?url=...&page=1&page_size=50
       ← { total, page, page_size, videos: [{ video_id, url, title }] }
```

---

## Running Locally

```bash
cd ytapi
pip install -e .          # or: uv sync
python main.py            # starts on :8000

# With auto-reload:
uvicorn main:app --reload --port 8000
```

API docs:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

**Requirements:**
- Python 3.11+
- `ffmpeg` and `ffprobe` on `PATH` (required for adaptive merge)
