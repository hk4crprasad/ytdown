import { useState, useEffect } from 'react';
import { api } from '../api';
import { useQueue } from '../context/QueueContext';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined leading-none ${className}`}>{name}</span>;
}

const PAGE = 50;

export default function PlaylistTab({ initialUrl = '' }) {
  const [url, setUrl]     = useState(initialUrl);
  const [info, setInfo]   = useState(null);
  const [vids, setVids]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState('');
  const [page, setPage]   = useState(1);
  const [dlMap, setDlMap] = useState({});
  const { startDownload } = useQueue();

  const doLookup = async (target) => {
    if (!target?.trim()) return;
    setLoading(true); setErr(''); setInfo(null); setVids(null);
    try {
      const [ir, vr] = await Promise.all([api.playlistInfo(target), api.playlistVids(target, 1, PAGE)]);
      if (ir.error) throw new Error(ir.error.message);
      setInfo(ir); setVids(vr); setPage(1);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (initialUrl) doLookup(initialUrl); }, []);

  const loadPage = async (p) => {
    setLoading(true);
    try { const r = await api.playlistVids(url, p, PAGE); setVids(r); setPage(p); }
    catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const dlVideo = async (v) => {
    setDlMap(m=>({...m,[v.video_id]:'loading'}));
    try { await startDownload(v.url,{title:v.title}); setDlMap(m=>({...m,[v.video_id]:'done'})); }
    catch { setDlMap(m=>({...m,[v.video_id]:'err'})); }
  };

  const totalPages = vids ? Math.ceil(vids.total / PAGE) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* URL input */}
      <div className="glass-panel glass-panel-border rounded-xl p-5">
        <div className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-3">Playlist Browser</div>
        <div className="flex gap-3 flex-wrap">
          <input
            id="playlist-url-input"
            className="input-recessed flex-1 min-w-60 rounded-lg px-4 py-2.5 text-body-sm"
            placeholder="https://youtube.com/playlist?list=..."
            value={url} onChange={e=>setUrl(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&doLookup(url)}
          />
          <button id="playlist-lookup-btn"
            className="btn-primary rounded-lg px-5 py-2.5 text-white text-label-sm uppercase tracking-wider flex items-center gap-2"
            onClick={()=>doLookup(url)} disabled={loading}>
            {loading?<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Icon name="queue_music" className="text-[16px]"/>}
            Load
          </button>
        </div>
      </div>

      {err && (
        <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border-error/30 text-error text-body-sm">
          <Icon name="error" className="text-[18px]"/>{err}
        </div>
      )}

      {/* Playlist info */}
      {info && (
        <div className="glass-panel glass-panel-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-headline-sm text-on-surface font-semibold mb-1">{info.title}</h2>
              <div className="text-body-sm text-on-surface-variant">
                {info.owner} · <a href={info.owner_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{info.owner_id}</a>
              </div>
            </div>
            <span className="chip-meta flex-shrink-0">Playlist</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['Videos',info.length??'—'],['Total Views',info.views?Number(info.views).toLocaleString():'—'],['Updated',info.last_updated||'—']].map(([k,v])=>(
              <div key={k} className="bg-surface-container rounded-lg p-3 border border-white/[0.06]">
                <div className="text-label-xs text-on-surface-variant mb-1">{k}</div>
                <div className="text-body-sm font-semibold text-on-surface">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video list */}
      {vids && (
        <div className="glass-panel glass-panel-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              {vids.total} Videos · Page {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <button className="btn-ghost rounded-lg px-3 py-1.5 text-label-sm text-on-surface-variant flex items-center gap-1"
                onClick={()=>loadPage(page-1)} disabled={page<=1||loading}>
                <Icon name="chevron_left" className="text-[16px]"/>Prev
              </button>
              <button className="btn-ghost rounded-lg px-3 py-1.5 text-label-sm text-on-surface-variant flex items-center gap-1"
                onClick={()=>loadPage(page+1)} disabled={page>=totalPages||loading}>
                Next<Icon name="chevron_right" className="text-[16px]"/>
              </button>
            </div>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {vids.videos.map((v, i) => (
              <div key={v.video_id} id={`pl-${v.video_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group">
                {/* Index */}
                <span className="w-8 text-right text-label-xs text-on-surface-variant flex-shrink-0">
                  {(page-1)*PAGE+i+1}
                </span>
                {/* Thumbnail */}
                <div className="relative flex-shrink-0 w-20 h-[45px] rounded-lg overflow-hidden bg-surface-container-high">
                  <img src={`https://img.youtube.com/vi/${v.video_id}/default.jpg`} alt="" loading="lazy"
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    onError={e=>{e.target.style.display='none';}}/>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icon name="play_arrow" className="text-white text-[18px]"/>
                  </div>
                </div>
                {/* Title */}
                <div className="flex-1 min-w-0">
                  <div className="text-body-sm font-medium text-on-surface truncate">{v.title || v.video_id}</div>
                  <div className="text-label-xs text-on-surface-variant font-mono mt-0.5">{v.video_id}</div>
                </div>
                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <a href={v.url} target="_blank" rel="noreferrer"
                    className="btn-ghost rounded px-2.5 py-1.5 text-label-xs text-on-surface-variant flex items-center gap-1 no-underline">
                    <Icon name="open_in_new" className="text-[12px]"/>Watch
                  </a>
                  <button id={`pl-dl-${v.video_id}`}
                    className={`rounded px-2.5 py-1.5 text-label-xs flex items-center gap-1 transition-all ${dlMap[v.video_id]==='done'?'btn-ghost text-green-400':dlMap[v.video_id]==='err'?'btn-ghost text-error':'btn-primary text-white'}`}
                    onClick={()=>dlVideo(v)} disabled={dlMap[v.video_id]==='loading'}>
                    {dlMap[v.video_id]==='loading'?<span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"/>
                      :dlMap[v.video_id]==='done'?<Icon name="check" className="text-[12px]"/>
                      :dlMap[v.video_id]==='err'?<Icon name="close" className="text-[12px]"/>
                      :<Icon name="download" className="text-[12px]"/>}
                    {!dlMap[v.video_id]&&'DL'}
                    {dlMap[v.video_id]==='done'&&'Queued'}
                    {dlMap[v.video_id]==='err'&&'Error'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!info && !loading && (
        <div className="flex flex-col items-center py-24 gap-4 text-on-surface-variant">
          <Icon name="queue_music" className="text-[56px] opacity-20"/>
          <div className="text-headline-sm font-semibold text-on-surface/50">Paste a playlist URL above</div>
          <div className="text-body-sm">Browse all videos, download any or all of them</div>
        </div>
      )}
    </div>
  );
}
