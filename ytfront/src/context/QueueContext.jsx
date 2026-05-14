import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { api } from '../api';

const QueueCtx = createContext(null);

export function QueueProvider({ children }) {
  const [jobs, setJobs] = useState({});   // { job_id: jobState }
  const sseSources = useRef({});

  const updateJob = useCallback((id, data) => {
    setJobs(prev => ({ ...prev, [id]: { ...prev[id], ...data } }));
  }, []);

  const startDownload = useCallback(async (url, streamInfo) => {
    const params = {};
    if (streamInfo?.itag) params.itag = streamInfo.itag;

    // Optimistically add job to queue
    const tempId = 'pending_' + Date.now();
    setJobs(prev => ({
      ...prev,
      [tempId]: {
        job_id: tempId, title: streamInfo?.title || 'Loading…',
        status: 'queued', phase: '', overall_pct: 0,
        video_pct: 0, audio_pct: 0, merge_pct: 0,
        video_res: streamInfo?.resolution || '',
        video_codec: streamInfo?.video_codec || '',
        audio_codec: '', audio_abr: '',
        video_speed_mbps: 0, audio_speed_mbps: 0,
        eta_seconds: null, error: null,
        _temp: true,
      }
    }));

    try {
      const res = await api.startMerge(url, params);
      if (res.error) throw new Error(res.error.message || JSON.stringify(res.error));

      const { job_id } = res;

      // Replace temp entry
      setJobs(prev => {
        const next = { ...prev };
        delete next[tempId];
        next[job_id] = {
          job_id, title: res.title, status: 'queued', phase: '',
          overall_pct: 0, video_pct: 0, audio_pct: 0, merge_pct: 0,
          video_res: res.video_res || '',
          video_codec: res.video_codec || '',
          audio_codec: '', audio_abr: '',
          video_speed_mbps: 0, audio_speed_mbps: 0,
          eta_seconds: null, error: null,
        };
        return next;
      });

      // Open SSE
      sseSources.current[job_id] = api.progressSSE(
        job_id,
        (data) => updateJob(job_id, data),
        (final) => updateJob(job_id, final),
      );

      return job_id;
    } catch (e) {
      setJobs(prev => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
      throw e;
    }
  }, [updateJob]);

  const removeJob = useCallback(async (id) => {
    if (sseSources.current[id]) {
      sseSources.current[id].close();
      delete sseSources.current[id];
    }
    try { await api.deleteJob(id); } catch {}
    setJobs(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  return (
    <QueueCtx.Provider value={{ jobs, startDownload, removeJob }}>
      {children}
    </QueueCtx.Provider>
  );
}

export function useQueue() {
  return useContext(QueueCtx);
}
