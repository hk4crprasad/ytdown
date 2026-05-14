"""
Download job registry + multi-threaded chunked downloader.

Architecture:
  - Each download gets a UUID job_id
  - Job state is stored in-memory in a thread-safe dict
  - Videos are split into N_THREADS chunks, downloaded in parallel via HTTP Range
  - Progress is emitted as SSE events from /merge/progress/{job_id}
"""
from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import urllib.request
import urllib.error

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Job state
# ---------------------------------------------------------------------------

DOWNLOAD_THREADS = 8       # parallel chunk threads per file
CHUNK_BYTES      = 2 * 1024 * 1024   # 2 MB per Range request


@dataclass
class DownloadJob:
    job_id: str
    url: str
    title: str
    video_itag: int
    audio_itag: int
    video_res: str
    video_codec: str
    audio_codec: str
    audio_abr: str
    output_path: str = ""
    status: str = "queued"       # queued | downloading | merging | done | error
    phase: str = ""              # video_download | audio_download | merging | done
    # progress 0-100 for each phase
    video_pct: float = 0.0
    audio_pct: float = 0.0
    merge_pct: float = 0.0
    overall_pct: float = 0.0
    # bytes tracking
    video_bytes_done: int = 0
    video_bytes_total: int = 0
    audio_bytes_done: int = 0
    audio_bytes_total: int = 0
    # speed
    video_speed_mbps: float = 0.0
    audio_speed_mbps: float = 0.0
    # timing
    started_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    eta_seconds: Optional[float] = None
    # error
    error: Optional[str] = None
    # events queue for SSE (list of dicts)
    _events: List[dict] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)
    _done_event: threading.Event = field(default_factory=threading.Event)

    def push_event(self, data: dict):
        with self._lock:
            self._events.append(data)

    def snapshot(self) -> dict:
        return {
            "job_id": self.job_id,
            "title": self.title,
            "status": self.status,
            "phase": self.phase,
            "video_pct": round(self.video_pct, 1),
            "audio_pct": round(self.audio_pct, 1),
            "merge_pct": round(self.merge_pct, 1),
            "overall_pct": round(self.overall_pct, 1),
            "video_bytes_done": self.video_bytes_done,
            "video_bytes_total": self.video_bytes_total,
            "audio_bytes_done": self.audio_bytes_done,
            "audio_bytes_total": self.audio_bytes_total,
            "video_speed_mbps": round(self.video_speed_mbps, 2),
            "audio_speed_mbps": round(self.audio_speed_mbps, 2),
            "video_res": self.video_res,
            "video_codec": self.video_codec,
            "audio_codec": self.audio_codec,
            "audio_abr": self.audio_abr,
            "eta_seconds": self.eta_seconds,
            "error": self.error,
            "output_path": self.output_path,
        }


# Global registry
_REGISTRY: Dict[str, DownloadJob] = {}
_REGISTRY_LOCK = threading.Lock()


def create_job(
    url: str, title: str,
    video_itag: int, audio_itag: int,
    video_res: str, video_codec: str,
    audio_codec: str, audio_abr: str,
) -> DownloadJob:
    job_id = uuid.uuid4().hex[:12]
    job = DownloadJob(
        job_id=job_id, url=url, title=title,
        video_itag=video_itag, audio_itag=audio_itag,
        video_res=video_res, video_codec=video_codec,
        audio_codec=audio_codec, audio_abr=audio_abr,
    )
    with _REGISTRY_LOCK:
        _REGISTRY[job_id] = job
    return job


def get_job(job_id: str) -> Optional[DownloadJob]:
    return _REGISTRY.get(job_id)


def list_jobs() -> List[dict]:
    with _REGISTRY_LOCK:
        return [j.snapshot() for j in _REGISTRY.values()]


# ---------------------------------------------------------------------------
# HTTP Range-based chunked downloader
# ---------------------------------------------------------------------------

def _get_content_length(url: str) -> int:
    """HEAD request to get file size."""
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=15) as r:
        cl = r.headers.get("Content-Length")
        return int(cl) if cl else 0


def _download_chunk(url: str, start: int, end: int, dest: str, retries: int = 3) -> int:
    """Download a byte range and write to dest. Returns bytes written."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, headers={"Range": f"bytes={start}-{end}"}
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            with open(dest, "wb") as f:
                f.write(data)
            return len(data)
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(1.5 ** attempt)
    return 0


def _assemble_chunks(chunk_files: List[str], output: str) -> None:
    """Concatenate ordered chunk files into a single output file."""
    with open(output, "wb") as out:
        for cf in chunk_files:
            with open(cf, "rb") as f:
                while True:
                    buf = f.read(512 * 1024)
                    if not buf:
                        break
                    out.write(buf)
    for cf in chunk_files:
        try:
            os.unlink(cf)
        except Exception:
            pass


def multithreaded_download(
    url: str,
    output_path: str,
    n_threads: int = DOWNLOAD_THREADS,
    progress_cb=None,     # callable(bytes_done, bytes_total, speed_mbps)
) -> int:
    """
    Download `url` to `output_path` using N parallel Range requests.
    Returns total bytes downloaded.
    """
    total = _get_content_length(url)

    if total == 0 or total < n_threads * CHUNK_BYTES:
        # File too small or server doesn't support Range → single-thread fallback
        logger.info("Single-thread download: %s bytes", total)
        bytes_done = 0
        t0 = time.time()
        req = urllib.request.urlopen(url, timeout=60)
        with open(output_path, "wb") as f:
            while True:
                chunk = req.read(512 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                bytes_done += len(chunk)
                speed = bytes_done / max(time.time() - t0, 0.001) / 1024 / 1024
                if progress_cb:
                    progress_cb(bytes_done, total or bytes_done, speed)
        return bytes_done

    # Split into N equal chunks
    chunk_size = total // n_threads
    ranges = []
    for i in range(n_threads):
        start = i * chunk_size
        end   = (start + chunk_size - 1) if i < n_threads - 1 else (total - 1)
        ranges.append((start, end))

    tmp_dir   = Path(settings.TEMP_DIR)
    base      = Path(output_path).stem
    chunk_files = [str(tmp_dir / f"{base}_chunk{i}.tmp") for i in range(n_threads)]

    bytes_done_arr = [0] * n_threads
    t0 = time.time()
    lock = threading.Lock()

    def _dl(i):
        start, end = ranges[i]
        written = _download_chunk(url, start, end, chunk_files[i])
        with lock:
            bytes_done_arr[i] = written
            done = sum(bytes_done_arr)
            elapsed = max(time.time() - t0, 0.001)
            speed = done / elapsed / 1024 / 1024
            if progress_cb:
                progress_cb(done, total, speed)
        return written

    with ThreadPoolExecutor(max_workers=n_threads) as ex:
        futures = {ex.submit(_dl, i): i for i in range(n_threads)}
        for f in as_completed(futures):
            f.result()  # re-raise exceptions

    _assemble_chunks(chunk_files, output_path)
    return total


# ---------------------------------------------------------------------------
# Main pipeline runner (called in background thread)
# ---------------------------------------------------------------------------

def _run_pipeline(
    job: DownloadJob,
    video_url: str,
    audio_url: str,
):
    import subprocess

    tmp_dir = Path(settings.TEMP_DIR)
    vid_path  = str(tmp_dir / f"v_{job.job_id}.mp4")
    aud_path  = str(tmp_dir / f"a_{job.job_id}.m4a")
    out_path  = str(tmp_dir / f"out_{job.job_id}.mp4")

    def _emit(extra: dict = {}):
        snap = job.snapshot()
        snap.update(extra)
        job.push_event(snap)

    try:
        # ── Phase 1: parallel download video + audio ──────────────────────
        job.status = "downloading"
        job.phase  = "downloading"
        _emit()

        video_done = threading.Event()
        audio_done = threading.Event()
        errors = []

        def dl_video():
            t0 = time.time()
            def cb(done, total, speed):
                job.video_bytes_done  = done
                job.video_bytes_total = total
                job.video_pct         = done / total * 100 if total else 0
                job.video_speed_mbps  = speed
                # overall = 40% video + 40% audio + 20% merge
                job.overall_pct = job.video_pct * 0.4 + job.audio_pct * 0.4
                if total and speed > 0:
                    remaining = (total - done) / 1024 / 1024 / speed
                    job.eta_seconds = round(remaining)
                _emit()
            try:
                multithreaded_download(video_url, vid_path, n_threads=DOWNLOAD_THREADS, progress_cb=cb)
                job.video_pct = 100.0
                _emit()
            except Exception as e:
                errors.append(f"Video download: {e}")
            finally:
                video_done.set()

        def dl_audio():
            t0 = time.time()
            def cb(done, total, speed):
                job.audio_bytes_done  = done
                job.audio_bytes_total = total
                job.audio_pct         = done / total * 100 if total else 0
                job.audio_speed_mbps  = speed
                job.overall_pct = job.video_pct * 0.4 + job.audio_pct * 0.4
                _emit()
            try:
                multithreaded_download(audio_url, aud_path, n_threads=4, progress_cb=cb)
                job.audio_pct = 100.0
                _emit()
            except Exception as e:
                errors.append(f"Audio download: {e}")
            finally:
                audio_done.set()

        t_vid = threading.Thread(target=dl_video, daemon=True)
        t_aud = threading.Thread(target=dl_audio, daemon=True)
        t_vid.start(); t_aud.start()
        t_vid.join();  t_aud.join()

        if errors:
            raise RuntimeError("; ".join(errors))

        # ── Phase 2: FFmpeg merge ─────────────────────────────────────────
        job.status = "merging"
        job.phase  = "merging"
        job.overall_pct = 80.0
        _emit()

        cmd = [
            "ffmpeg", "-y",
            "-i", vid_path,
            "-i", aud_path,
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            "-loglevel", "error",
            "-progress", "pipe:1",
            "-stats_period", "0.5",
            out_path,
        ]

        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )

        # Parse ffmpeg -progress output for merge progress
        video_duration_s = None
        try:
            import re
            # Get video duration from ffprobe
            probe = subprocess.run(
                ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", vid_path],
                capture_output=True, text=True
            )
            if probe.returncode == 0:
                video_duration_s = float(probe.stdout.strip())
        except Exception:
            pass

        for line in proc.stdout:
            line = line.strip()
            if line.startswith("out_time_ms="):
                try:
                    ms = int(line.split("=")[1])
                    if video_duration_s and video_duration_s > 0:
                        pct = min((ms / 1_000_000) / video_duration_s * 100, 99)
                        job.merge_pct  = pct
                        job.overall_pct = 80 + pct * 0.2
                        _emit()
                except Exception:
                    pass

        proc.wait()
        if proc.returncode != 0:
            err_out = proc.stderr.read() if proc.stderr else ""
            raise RuntimeError(f"ffmpeg failed: {err_out}")

        # ── Phase 3: Done ─────────────────────────────────────────────────
        job.status      = "done"
        job.phase       = "done"
        job.merge_pct   = 100.0
        job.overall_pct = 100.0
        job.output_path = out_path
        job.finished_at = time.time()
        _emit({"download_url": f"/merge/file/{job.job_id}"})

    except Exception as exc:
        logger.exception("Job %s failed: %s", job.job_id, exc)
        job.status = "error"
        job.error  = str(exc)
        _emit()
    finally:
        # Cleanup temp video+audio (keep merged output until fetched)
        for p in [vid_path, aud_path]:
            try:
                os.unlink(p)
            except Exception:
                pass
        job._done_event.set()


def start_pipeline(
    job: DownloadJob,
    video_url: str,
    audio_url: str,
) -> None:
    """Launch pipeline in a background daemon thread."""
    t = threading.Thread(
        target=_run_pipeline,
        args=(job, video_url, audio_url),
        daemon=True,
        name=f"dl-{job.job_id}",
    )
    t.start()
