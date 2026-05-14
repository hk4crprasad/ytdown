import { useState } from 'react';
import { api } from '../api';
import { useQueue } from '../context/QueueContext';

export default function PlaylistTab() {
  const [url, setUrl]       = useState('');
  const [info, setInfo]     = useState(null);
  const [vids, setVids]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');
  const [page, setPage]     = useState(1);
  const [dlMap, setDlMap]   = useState({});  // video_id -> loading/done
  const { startDownload }   = useQueue();
  const PAGE = 50;

  const lookup = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setInfo(null); setVids(null);
    try {
      const [ir, vr] = await Promise.all([api.playlistInfo(url), api.playlistVids(url,1,PAGE)]);
      if (ir.error) throw new Error(ir.error.message);
      setInfo(ir); setVids(vr); setPage(1);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const loadPage = async (p) => {
    setLoading(true);
    try { const r = await api.playlistVids(url,p,PAGE); setVids(r); setPage(p); }
    catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const dlVideo = async (v) => {
    setDlMap(m => ({ ...m, [v.video_id]: 'loading' }));
    try {
      await startDownload(v.url, {});
      setDlMap(m => ({ ...m, [v.video_id]: 'done' }));
    } catch {
      setDlMap(m => ({ ...m, [v.video_id]: 'err' }));
    }
  };

  const totalPages = vids ? Math.ceil(vids.total / PAGE) : 0;

  return (
    <>
      <div className="card">
        <div className="card-title" style={{marginBottom:'0.75rem'}}>📋 Playlist Browser</div>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
          <input
            id="playlist-url-input"
            style={{flex:1,minWidth:260,padding:'0.7rem 1rem',border:'2px solid var(--border)',borderRadius:'var(--radius-pill)',fontFamily:'Inter,sans-serif',fontSize:'0.9rem',outline:'none'}}
            placeholder="https://youtube.com/playlist?list=..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key==='Enter' && lookup()}
            onFocus={e => e.target.style.borderColor='var(--red)'}
            onBlur={e => e.target.style.borderColor='var(--border)'}
          />
          <button id="playlist-lookup-btn" className="btn btn-red" onClick={lookup} disabled={loading}>
            {loading ? <span className="spinner" style={{borderColor:'rgba(255,255,255,0.3)',borderTopColor:'#fff'}}/> : '📋 Load'}
          </button>
        </div>
      </div>

      {err && <div className="alert alert-error">⚠ {err}</div>}

      {info && (
        <div className="card" id="playlist-info-card">
          <div className="card-header"><span className="card-title">Playlist Info</span></div>
          <div className="stat-row" style={{marginBottom:'1rem'}}>
            <div className="stat"><div className="stat-val">{info.length ?? '—'}</div><div className="stat-key">Videos</div></div>
            <div className="stat"><div className="stat-val">{info.views ? Number(info.views).toLocaleString() : '—'}</div><div className="stat-key">Total Views</div></div>
            <div className="stat"><div className="stat-val">{info.last_updated || '—'}</div><div className="stat-key">Updated</div></div>
          </div>
          <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'0.3rem'}}>{info.title}</div>
          <div style={{fontSize:'0.85rem',color:'var(--text2)'}}>{info.owner} &nbsp;·&nbsp;
            <a href={info.owner_url} target="_blank" rel="noreferrer" style={{color:'var(--red)',textDecoration:'none'}}>{info.owner_id}</a>
          </div>
        </div>
      )}

      {vids && (
        <div className="card" id="playlist-videos-card">
          <div className="card-header">
            <span className="card-title">Videos — {vids.total} total · Page {page}/{totalPages}</span>
            <div style={{display:'flex',gap:'0.4rem'}}>
              <button className="btn btn-ghost btn-sm" onClick={() => loadPage(page-1)} disabled={page<=1||loading}>← Prev</button>
              <button className="btn btn-ghost btn-sm" onClick={() => loadPage(page+1)} disabled={page>=totalPages||loading}>Next →</button>
            </div>
          </div>
          <div className="playlist-grid">
            {vids.videos.map((v, i) => (
              <div key={v.video_id} className="playlist-card" id={`pl-${v.video_id}`}>
                <div className="pl-idx">{(page-1)*PAGE+i+1}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:'var(--mono)',fontSize:'0.75rem',color:'var(--text2)',marginBottom:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.video_id}</div>
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    <a href={v.url} target="_blank" rel="noreferrer" className="btn btn-xs btn-ghost" style={{textDecoration:'none'}}>Watch</a>
                    <button
                      className={`btn btn-xs ${dlMap[v.video_id]==='done'?'btn-green':dlMap[v.video_id]==='err'?'btn-ghost':'btn-red'}`}
                      onClick={() => dlVideo(v)}
                      disabled={dlMap[v.video_id]==='loading'}
                    >
                      {dlMap[v.video_id]==='loading' ? <span className="spinner"/> : dlMap[v.video_id]==='done' ? '✓' : dlMap[v.video_id]==='err' ? '✗' : '⬇'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!info && !loading && (
        <div className="empty">
          <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
          <div className="empty-title">Paste a playlist URL above</div>
          <div className="empty-sub">Browse all videos, download any or all of them</div>
        </div>
      )}
    </>
  );
}
