const BASE = 'http://localhost:8000';

const _get  = (path) => fetch(`${BASE}${path}`).then(r => r.json());
const _post = (path, body) => fetch(`${BASE}${path}`, { method: 'POST', body }).then(r => r.json());
const _del  = (path) => fetch(`${BASE}${path}`, { method: 'DELETE' }).then(r => r.json());

export const api = {
  health:       ()        => _get('/health'),
  tokenStatus:  ()        => _get('/token/status'),
  uploadToken:  (file)    => { const fd = new FormData(); fd.append('file', file); return _post('/upload/token', fd); },

  videoInfo:    (url)     => _get(`/video/info?url=${encodeURIComponent(url)}`),
  videoStreams:  (url)     => _get(`/video/streams?url=${encodeURIComponent(url)}`),
  mergeOptions: (url)     => _get(`/merge/options?url=${encodeURIComponent(url)}`),
  audioStreams:  (url)     => _get(`/audio/streams?url=${encodeURIComponent(url)}`),
  captionsList:  (url)    => _get(`/captions/list?url=${encodeURIComponent(url)}`),
  thumbnails:   (url)     => _get(`/video/thumbnails?url=${encodeURIComponent(url)}`),
  playlistInfo: (url)     => _get(`/playlist/info?url=${encodeURIComponent(url)}`),
  playlistVids: (url, p=1, sz=50) => _get(`/playlist/videos?url=${encodeURIComponent(url)}&page=${p}&page_size=${sz}`),
  search:       (q, opts) => { const p = new URLSearchParams({ q, ...opts }); return _get(`/search?${p}`); },

  // Job system
  startMerge:   (url, params={}) => {
    const p = new URLSearchParams({ url, ...params });
    return _post(`/merge/start?${p}`);
  },
  getJobs:      ()        => _get('/merge/jobs'),
  deleteJob:    (id)      => _del(`/merge/job/${id}`),
  fileUrl:      (id)      => `${BASE}/merge/file/${id}`,

  // SSE
  progressSSE:  (jobId, onEvent, onDone) => {
    const src = new EventSource(`${BASE}/merge/progress/${jobId}`);
    src.onmessage = (e) => {
      const data = JSON.parse(e.data);
      onEvent(data);
      if (data._eof || data.status === 'done' || data.status === 'error') {
        src.close();
        onDone && onDone(data);
      }
    };
    src.onerror = () => { src.close(); onDone && onDone({ status: 'error', error: 'SSE connection lost' }); };
    return src;
  },
};
