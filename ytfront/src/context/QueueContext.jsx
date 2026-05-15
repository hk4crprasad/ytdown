import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { api } from '../api';

const QueueCtx = createContext(null);

function extractVideoId(url) {
  if (!url) return null;
  const m = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?/]+)/);
  return m?.[1] || null;
}

export function QueueProvider({ children }) {
  const [jobs, setJobs] = useState({});
  const sseSources = useRef({});

  const updateJob = useCallback((id, data) => {
    setJobs(prev => ({ ...prev, [id]: { ...prev[id], ...data } }));
  }, []);

  const startDownload = useCallback(async (url, streamInfo = {}) => {
    const params = {};
    if (streamInfo?.itag === 'audio') { params.audio_subtype = 'mp4'; }
    else if (streamInfo?.itag) { params.itag = streamInfo.itag; }

    const videoId = extractVideoId(url);
    const tempId = 'pending_' + Date.now();

    setJobs(prev => ({
      ...prev,
      [tempId]: {
        job_id: tempId, title: streamInfo?.title || 'Loading…',
        status: 'queued', overall_pct: 0,
        video_pct: 0, audio_pct: 0, merge_pct: 0,
        video_bytes_done: 0, video_bytes_total: 0,
        audio_bytes_done: 0, audio_bytes_total: 0,
        video_speed_mbps: 0, eta_seconds: null, error: null,
        video_id: videoId, _temp: true,
      }
    }));

    try {
      const res = await api.startMerge(url, params);
      if (res.error) throw new Error(res.error.message || JSON.stringify(res.error));
      const { job_id } = res;

      setJobs(prev => {
        const next = { ...prev };
        delete next[tempId];
        next[job_id] = {
          job_id, title: res.title, status: 'queued',
          overall_pct: 0, video_pct: 0, audio_pct: 0, merge_pct: 0,
          video_bytes_done: 0, video_bytes_total: 0,
          audio_bytes_done: 0, audio_bytes_total: 0,
          video_res: res.video_res || '', video_speed_mbps: 0,
          eta_seconds: null, error: null, video_id: videoId,
        };
        return next;
      });

      sseSources.current[job_id] = api.progressSSE(
        job_id,
        (data) => updateJob(job_id, data),
        (final) => updateJob(job_id, final),
      );
      return job_id;
    } catch (e) {
      setJobs(prev => { const n = { ...prev }; delete n[tempId]; return n; });
      throw e;
    }
  }, [updateJob]);

  const removeJob = useCallback(async (id) => {
    sseSources.current[id]?.close();
    delete sseSources.current[id];
    try { await api.deleteJob(id); } catch {}
    setJobs(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  return (
    <QueueCtx.Provider value={{ jobs, startDownload, removeJob }}>
      {children}
    </QueueCtx.Provider>
  );
}

export const useQueue = () => useContext(QueueCtx);
