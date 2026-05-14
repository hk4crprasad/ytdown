# 🎬 YouTube Media Extraction API

Production-grade SaaS-level YouTube downloader & streaming API built with **FastAPI** + **pytubefix**.

---

## ✨ Features

| Category | Capabilities |
|---|---|
| **Video** | Full metadata, all streams, best quality, direct streaming, thumbnails |
| **Audio** | Audio-only extraction, best bitrate selection, direct streaming |
| **Captions** | List tracks, download SRT / TXT / XML, auto-generated support |
| **Playlist** | Metadata, paginated video list, batch download URLs |
| **Shorts** | Auto-detection, full stream list, direct download |
| **Search** | Query + Filter (type, duration, date, sort) + pagination |
| **Tokens** | Dynamic upload of `tokens.json` without restart, backup, status |

---

## 🚀 Quick Start

```bash
cd ytapi

# 1. Install dependencies
pip install -r requirements.txt

# 2. (Optional) copy env
cp .env.example .env

# 3. Run with local pytubefix source
PYTHONPATH=/path/to/pytubefix/parent uvicorn main:app --reload

# Or standard pip-installed pytubefix:
uvicorn main:app --reload
```

Swagger UI → **http://localhost:8000/docs**  
ReDoc     → **http://localhost:8000/redoc**

---

## 🐳 Docker

```bash
docker compose up --build
```

---

## 📡 API Endpoints

### Token Management
| Method | Path | Description |
|---|---|---|
| `POST` | `/upload/token` | Upload / replace `tokens.json` |
| `GET` | `/token/status` | Check token file validity & readiness |

### Video
| Method | Path | Description |
|---|---|---|
| `GET` | `/video/info` | Full video metadata |
| `GET` | `/video/streams` | All streams (filterable) |
| `GET` | `/video/best` | Highest resolution stream info |
| `GET` | `/video/download` | Stream video bytes to client |
| `GET` | `/video/thumbnails` | All thumbnail URLs |

### Audio
| Method | Path | Description |
|---|---|---|
| `GET` | `/audio/streams` | All audio-only streams |
| `GET` | `/audio/best` | Best audio stream info |
| `GET` | `/audio/download` | Stream audio bytes |

### Captions
| Method | Path | Description |
|---|---|---|
| `GET` | `/captions/list` | List caption tracks |
| `GET` | `/captions/download` | Download SRT / TXT / XML |

### Playlist
| Method | Path | Description |
|---|---|---|
| `GET` | `/playlist/info` | Playlist metadata |
| `GET` | `/playlist/videos` | Paginated video list |
| `POST` | `/playlist/download` | Batch stream URLs |

### Shorts
| Method | Path | Description |
|---|---|---|
| `GET` | `/shorts/info` | Shorts metadata + streams |
| `GET` | `/shorts/download` | Direct short download |

### Search
| Method | Path | Description |
|---|---|---|
| `GET` | `/search` | YouTube search with filters |

### Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |

---

## 🔑 Token Upload (curl)

```bash
# Upload tokens.json
curl -X POST http://localhost:8000/upload/token \
  -F "file=@./tokens.json"

# Check status
curl http://localhost:8000/token/status
```

---

## 💡 Usage Examples

```bash
# Video info
curl "http://localhost:8000/video/info?url=https://youtube.com/watch?v=dQw4w9WgXcQ"

# All streams
curl "http://localhost:8000/video/streams?url=https://youtube.com/watch?v=dQw4w9WgXcQ&progressive=true"

# Best stream info
curl "http://localhost:8000/video/best?url=https://youtube.com/watch?v=dQw4w9WgXcQ"

# Download video (stream to file)
curl -o video.mp4 "http://localhost:8000/video/download?url=https://youtube.com/watch?v=dQw4w9WgXcQ"

# Best audio
curl -o audio.m4a "http://localhost:8000/audio/download?url=https://youtube.com/watch?v=dQw4w9WgXcQ"

# List captions
curl "http://localhost:8000/captions/list?url=https://youtube.com/watch?v=dQw4w9WgXcQ"

# Download SRT
curl "http://localhost:8000/captions/download?url=...&lang_code=en&fmt=srt&raw=true"

# Playlist info
curl "http://localhost:8000/playlist/info?url=https://youtube.com/playlist?list=PL..."

# Search
curl "http://localhost:8000/search?q=python+tutorial&result_type=video&sort_by=views"
```

---

## ⚙️ Configuration (.env)

| Variable | Default | Description |
|---|---|---|
| `APP_PORT` | `8000` | Server port |
| `DEBUG` | `false` | Enable auto-reload |
| `TOKEN_FILE` | `./tokens.json` | OAuth token path |
| `LOG_LEVEL` | `INFO` | Logging level |
| `CHUNK_SIZE` | `524288` | Stream chunk size (bytes) |
| `DEFAULT_CLIENT` | `IOS` | pytubefix YouTube client |

---

## 📁 Project Structure

```
ytapi/
├── main.py                    # Entrypoint
├── requirements.txt
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml
├── start.sh
├── .env.example
└── app/
    ├── __init__.py            # FastAPI app factory
    ├── core/
    │   ├── config.py          # Settings (pydantic-settings)
    │   ├── dependencies.py    # DI helpers (token_file)
    │   ├── exceptions.py      # Global exception handlers
    │   └── logging_config.py  # Rotating log setup
    ├── middleware/
    │   └── logging_middleware.py
    ├── routers/
    │   ├── token.py
    │   ├── video.py
    │   ├── audio.py
    │   ├── captions.py
    │   ├── playlist.py
    │   ├── shorts.py
    │   ├── search.py
    │   └── health.py
    ├── schemas/
    │   └── schemas.py         # All Pydantic response models
    └── services/
        ├── youtube_service.py # Core metadata & stream extraction
        ├── playlist_service.py
        └── token_service.py
```
