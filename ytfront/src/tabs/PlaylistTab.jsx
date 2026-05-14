import { useState } from 'react';
import { api } from '../api';

export default function PlaylistTab() {
  const [url, setUrl]     = useState('');
  const [info, setInfo]   = useState(null);
  const [vids, setVids]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState('');
  const [page, setPage]   = useState(1);

  const PAGE_SIZE = 50;

  const lookup = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setInfo(null); setVids(null); setPage(1);
    try {
      const [infoRes, vidsRes] = await Promise.all([
        api.playlistInfo(url),
        api.playlistVids(url, 1, PAGE_SIZE),
      ]);
      if (infoRes.error) throw new Error(infoRes.error.message);
      setInfo(infoRes);
      setVids(vidsRes);
    } catch(e) {
      setErr(e.message || 'Failed to fetch playlist.');
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (p) => {
    setLoading(true);
    try {
      const res = await api.playlistVids(url, p, PAGE_SIZE);
      setVids(res); setPage(p);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const totalPages = vids ? Math.ceil(vids.total / PAGE_SIZE) : 0;

  return (
    <>
      <h1 className="section-title">Playlist Browser</h1>
      <p className="section-sub">Inspect a YouTube playlist and browse all its videos.</p>

      <div className="search-wrap">
        <div className="search-label">Playlist URL</div>
        <div className="search-row">
          <input
            id="playlist-url-input"
            className="search-input"
            placeholder="https://youtube.com/playlist?list=..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
          />
          <button id="playlist-lookup-btn" className="btn btn-primary" onClick={lookup} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Load'}
          </button>
        </div>
      </div>

      {err && <div className="alert alert-error">⚠ {err}</div>}

      {info && (
        <div className="card" id="playlist-info-card">
          <div className="card-header"><span className="card-title">Playlist Info</span></div>
          <div className="stat-row">
            <div className="stat"><div className="stat-val">{info.length ?? '—'}</div><div className="stat-key">Videos</div></div>
            <div className="stat"><div className="stat-val">{info.views ? Number(info.views).toLocaleString() : '—'}</div><div className="stat-key">Views</div></div>
            <div className="stat"><div className="stat-val">{info.last_updated ?? '—'}</div><div className="stat-key">Last Updated</div></div>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <div className="meta-key">Title</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: 4 }}>{info.title}</div>
          </div>
          <div>
            <div className="meta-key">Channel</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text2)', marginTop: 4 }}>
              {info.owner} &nbsp;·&nbsp;
              <a href={info.owner_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)', textDecoration: 'none' }}>
                {info.owner_id}
              </a>
            </div>
          </div>
        </div>
      )}

      {vids && (
        <div className="card" id="playlist-videos-card">
          <div className="card-header">
            <span className="card-title">Videos — {vids.total} total</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>Page {page} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => loadPage(page-1)} disabled={page <= 1 || loading}>←</button>
              <button className="btn btn-ghost btn-sm" onClick={() => loadPage(page+1)} disabled={page >= totalPages || loading}>→</button>
            </div>
          </div>
          <div className="playlist-grid">
            {vids.videos.map((v, i) => (
              <div key={v.video_id} className="playlist-item" id={`pl-vid-${v.video_id}`}>
                <div className="playlist-index">{(page-1)*PAGE_SIZE + i + 1}</div>
                <div className="playlist-vid">
                  <div className="playlist-vid-id">{v.video_id}</div>
                  <a href={v.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: '0.7rem', color: 'var(--accent)', textDecoration: 'none' }}>
                    Watch ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
