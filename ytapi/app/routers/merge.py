"""
Merge & Download endpoints — full job system with SSE progress.

POST /merge/start          — create job, returns job_id
GET  /merge/progress/{id}  — SSE stream of progress events
GET  /merge/file/{id}      — download the finished merged file
GET  /merge/jobs           — list all jobs
GET  /merge/options        — list adaptive video streams (helper)
DELETE /merge/job/{id}     — cancel / clear a job
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from app.core.config import settings
from app.core.dependencies import get_token_file
from app.services.download_service import (
    create_job, get_job, list_jobs, start_pipeline,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Merge & Download"])


def _resolve_tok(token_file: Optional[str]) -> Optional[str]:
    if token_file and os.path.exists(token_file):
        return token_file
    return None


def _build_yt(url: str, tok: Optional[str]):
    from pytubefix import YouTube
    return YouTube(url, token_file=tok)


# ---------------------------------------------------------------------------
# GET /merge/options
# ---------------------------------------------------------------------------
@router.get("/merge/options", summary="List adaptive video streams")
async def merge_options(
    url: str = Query(...),
    token_file: Optional[str] = Depends(get_token_file),
):
    from app.services.youtube_service import _stream_to_schema
    tok = _resolve_tok(token_file)
    yt  = _build_yt(url, tok)
    yt.check_availability()

    video_streams = (
        yt.streams.filter(only_video=True, adaptive=True)
        .order_by("resolution").fmt_streams[::-1]
    )
    best_audio = yt.streams.get_audio_only(subtype="mp4")
    if not best_audio:
        best_audio = yt.streams.filter(only_audio=True).order_by("abr").last()

    return {
        "video_id":     yt.video_id,
        "title":        yt.title,
        "auto_audio":   _stream_to_schema(best_audio) if best_audio else None,
        "video_streams":[_stream_to_schema(s) for s in video_streams],
    }


# ---------------------------------------------------------------------------
# POST /merge/start  — create a job and start background pipeline
# ---------------------------------------------------------------------------
@router.post("/merge/start", summary="Start merge+download job")
async def merge_start(
    url: str = Query(...),
    itag: Optional[int] = Query(None, description="Video itag; omit for best"),
    audio_itag: Optional[int] = Query(None, description="Audio itag; omit for best"),
    audio_subtype: str = Query("mp4"),
    token_file: Optional[str] = Depends(get_token_file),
):
    from app.services.youtube_service import _stream_to_schema
    tok = _resolve_tok(token_file)
    yt  = _build_yt(url, tok)
    yt.check_availability()

    # Resolve video stream
    if itag:
        vs = yt.streams.get_by_itag(itag)
        if not vs:
            raise HTTPException(404, f"itag {itag} not found")
    else:
        vs = (yt.streams.filter(only_video=True, adaptive=True)
              .order_by("resolution").last())
    if not vs:
        raise HTTPException(404, "No video stream found")

    # If progressive (already has audio), download directly without merge
    if vs.is_progressive:
        si = _stream_to_schema(vs)
        job = create_job(
            url=url, title=yt.title,
            video_itag=si.itag, audio_itag=0,
            video_res=si.resolution or "", video_codec=si.video_codec or "",
            audio_codec=si.audio_codec or "", audio_abr=si.abr or "",
        )
        # Run single-thread direct download for progressive
        import threading
        from app.services.download_service import multithreaded_download
        from pathlib import Path

        out = str(Path(settings.TEMP_DIR) / f"out_{job.job_id}.mp4")

        def _dl_progressive():
            try:
                job.status = "downloading"; job.phase = "downloading"
                def cb(done, total, speed):
                    job.video_bytes_done = done; job.video_bytes_total = total
                    job.video_pct = done/total*100 if total else 0
                    job.overall_pct = job.video_pct
                    job.video_speed_mbps = speed
                    job.push_event(job.snapshot())
                multithreaded_download(si.url, out, n_threads=8, progress_cb=cb)
                job.status = "done"; job.phase = "done"
                job.video_pct = job.overall_pct = 100.0
                job.output_path = out; job.finished_at = time.time()
                job.push_event({**job.snapshot(), "download_url": f"/merge/file/{job.job_id}"})
            except Exception as e:
                job.status = "error"; job.error = str(e); job.push_event(job.snapshot())
            finally:
                job._done_event.set()

        threading.Thread(target=_dl_progressive, daemon=True, name=f"dl-{job.job_id}").start()
        return {"job_id": job.job_id, "title": yt.title, "mode": "progressive"}

    # Resolve audio stream
    if audio_itag:
        as_ = yt.streams.get_by_itag(audio_itag)
    else:
        as_ = yt.streams.get_audio_only(subtype=audio_subtype)
        if not as_:
            as_ = yt.streams.filter(only_audio=True).order_by("abr").last()
    if not as_:
        raise HTTPException(404, "No audio stream found")

    si_v = _stream_to_schema(vs)
    si_a = _stream_to_schema(as_)

    job = create_job(
        url=url, title=yt.title,
        video_itag=si_v.itag, audio_itag=si_a.itag,
        video_res=si_v.resolution or "", video_codec=si_v.video_codec or "",
        audio_codec=si_a.audio_codec or "", audio_abr=si_a.abr or "",
    )

    start_pipeline(job, video_url=si_v.url, audio_url=si_a.url)

    return {
        "job_id":      job.job_id,
        "title":       yt.title,
        "video_itag":  si_v.itag,
        "audio_itag":  si_a.itag,
        "video_res":   si_v.resolution,
        "video_codec": si_v.video_codec,
        "audio_codec": si_a.audio_codec,
        "mode":        "adaptive_merge",
    }


# ---------------------------------------------------------------------------
# GET /merge/progress/{job_id}  — SSE stream
# ---------------------------------------------------------------------------
@router.get("/merge/progress/{job_id}", summary="SSE progress stream for a download job")
async def merge_progress(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, f"Job {job_id} not found")

    async def event_generator():
        sent = 0
        yield f"data: {json.dumps(job.snapshot())}\n\n"

        while True:
            await asyncio.sleep(0.15)

            with job._lock:
                new_events = job._events[sent:]
                sent += len(new_events)

            for ev in new_events:
                yield f"data: {json.dumps(ev)}\n\n"

            if job.status in ("done", "error"):
                # Drain remaining
                with job._lock:
                    final = job._events[sent:]
                for ev in final:
                    yield f"data: {json.dumps(ev)}\n\n"
                yield f"data: {json.dumps({**job.snapshot(), '_eof': True})}\n\n"
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# GET /merge/file/{job_id}  — serve finished file
# ---------------------------------------------------------------------------
@router.get("/merge/file/{job_id}", summary="Download the merged output file")
async def merge_file(job_id: str):
    from fastapi import BackgroundTasks
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "done":
        raise HTTPException(400, f"Job not finished yet (status={job.status})")
    if not job.output_path or not os.path.exists(job.output_path):
        raise HTTPException(410, "Output file no longer available")

    safe = "".join(c for c in job.title if c.isalnum() or c in " ._-").strip() or "download"

    return FileResponse(
        path=job.output_path,
        media_type="video/mp4",
        filename=f"{safe}.mp4",
        headers={
            "X-Job-Id":      job_id,
            "X-Video-Res":   job.video_res,
            "X-Video-Codec": job.video_codec,
        },
    )


# ---------------------------------------------------------------------------
# GET /merge/jobs  — all jobs
# ---------------------------------------------------------------------------
@router.get("/merge/jobs", summary="List all download jobs")
async def get_jobs():
    return {"jobs": list_jobs(), "total": len(list_jobs())}


# ---------------------------------------------------------------------------
# DELETE /merge/job/{job_id}  — clear a job record + file
# ---------------------------------------------------------------------------
@router.delete("/merge/job/{job_id}", summary="Clear job and delete output file")
async def delete_job(job_id: str):
    from app.services.download_service import _REGISTRY, _REGISTRY_LOCK
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.output_path and os.path.exists(job.output_path):
        os.unlink(job.output_path)
    with _REGISTRY_LOCK:
        _REGISTRY.pop(job_id, None)
    return {"deleted": job_id}
