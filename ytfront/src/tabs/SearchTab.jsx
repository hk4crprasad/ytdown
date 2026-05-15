import { useState, useEffect } from 'react';
import { api } from '../api';
import { useQueue } from '../context/QueueContext';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined leading-none ${className}`}>{name}</span>;
}

const FILTERS = [
  { label:'Type',     key:'result_type', opts:['','video','channel','playlist'] },
  { label:'Date',     key:'upload_date', opts:['','hour','today','week','month','year'] },
  { label:'Duration', key:'duration',    opts:['','short','medium','long'] },
  { label:'Sort',     key:'sort_by',     opts:['','relevance','date','views','rating'] },
];

const TYPE_ICON = { video:'smart_display', channel:'subscriptions', playlist:'queue_music', short:'bolt' };

export default function SearchTab({ initialQuery = '' }) {
  const [q, setQ]         = useState(initialQuery);
  const [filters, setFilters] = useState({result_type:'',upload_date:'',duration:'',sort_by:''});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState('');
  const [page, setPage]   = useState(1);
  const [dlMap, setDlMap] = useState({});
  const [activeType, setActiveType] = useState('videos');
  const { startDownload } = useQueue();

  const doSearch = async (p = 1, override) => {
    const term = (override ?? q).trim();
    if (!term) return;
    setLoading(true); setErr('');
    try {
      const opts = { page: p };
      Object.entries(filters).forEach(([k,v])=>{ if(v) opts[k]=v; });
      const res = await api.search(term, opts);
      if (res.error) throw new Error(res.error.message);
      setResults(res); setPage(p);
    } catch(e) { setErr(e.message||'Search failed.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (initialQuery) doSearch(1, initialQuery); }, []);

  const dlResult = async (r) => {
    const videoUrl = `https://youtube.com/watch?v=${r.video_id}`;
    setDlMap(m=>({...m,[r.video_id]:'loading'}));
    try { await startDownload(videoUrl,{title:r.title}); setDlMap(m=>({...m,[r.video_id]:'done'})); }
    catch { setDlMap(m=>({...m,[r.video_id]:'err'})); }
  };

  const resultSets = results ? {
    videos:results.videos||[], shorts:results.shorts||[],
    playlists:results.playlists||[], channels:results.channels||[],
  } : {};

  const activeResults = resultSets[activeType] || [];

  return (
    <div className="flex flex-col gap-5">
      {/* Search bar */}
      <div className="glass-panel glass-panel-border rounded-xl p-5">
        <div className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-3">YouTube Search</div>
        <div className="flex gap-3 flex-wrap mb-4">
          <input
            id="search-input"
            className="input-recessed flex-1 min-w-60 rounded-lg px-4 py-2.5 text-body-sm"
            placeholder="Search videos, channels, playlists…"
            value={q} onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&doSearch(1)}
          />
          <button id="search-btn" className="btn-primary rounded-lg px-5 py-2.5 text-white text-label-sm uppercase tracking-wider flex items-center gap-2"
            onClick={()=>doSearch(1)} disabled={loading}>
            {loading?<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Icon name="search" className="text-[16px]"/>}
            Search
          </button>
        </div>
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {FILTERS.map(({label,key,opts})=>(
            <div key={key}>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-wider mb-1">{label}</div>
              <select
                id={`filter-${key}`}
                className="input-recessed rounded-lg px-3 py-1.5 text-label-sm bg-black cursor-pointer"
                value={filters[key]} onChange={e=>setFilters(f=>({...f,[key]:e.target.value}))}>
                {opts.map(o=><option key={o} value={o}>{o||`Any ${label}`}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {err && (
        <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border-error/30 text-error text-body-sm">
          <Icon name="error" className="text-[18px]"/>{err}
        </div>
      )}

      {results && (
        <>
          {/* Result meta + pagination */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-body-sm text-on-surface-variant">
              {Object.entries(resultSets).map(([k,v])=>`${v.length} ${k}`).join(' · ')}
              {results.suggestions?.length>0 && (
                <span className="ml-2">· Try: {results.suggestions.slice(0,3).map((s,i)=>(
                  <button key={i} onClick={()=>{setQ(s);doSearch(1,s);}}
                    className="ml-1 text-primary hover:underline text-body-sm">{s}</button>
                ))}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost rounded-lg px-3 py-1.5 text-label-sm text-on-surface-variant flex items-center gap-1"
                disabled={page<=1||loading} onClick={()=>doSearch(page-1)}>
                <Icon name="chevron_left" className="text-[16px]"/>Prev
              </button>
              <button className="btn-ghost rounded-lg px-3 py-1.5 text-label-sm text-on-surface-variant flex items-center gap-1"
                disabled={loading} onClick={()=>doSearch(page+1)}>
                Next<Icon name="chevron_right" className="text-[16px]"/>
              </button>
            </div>
          </div>

          {/* Type tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {Object.entries(resultSets).map(([k,v])=>(
              <button key={k} onClick={()=>setActiveType(k)}
                className={`px-4 py-2 rounded-full text-label-sm whitespace-nowrap transition-all border ${activeType===k?'bg-primary/15 text-primary border-primary/30':'text-on-surface-variant border-outline-variant/30 hover:border-primary/20 hover:text-primary/70'}`}>
                {k.charAt(0).toUpperCase()+k.slice(1)} ({v.length})
              </button>
            ))}
          </div>

          {activeResults.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-on-surface-variant">
              <Icon name="search_off" className="text-[48px] opacity-20"/>
              <div className="text-body-md">No {activeType} found</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" id={`results-${activeType}`}>
              {activeResults.map((r,i) => (
                <div key={r.video_id||r.url} id={r.video_id?`result-${r.video_id}`:undefined}
                  className="result-card"
                  style={{animationDelay:`${Math.min(i*0.04,0.4)}s`}}>
                  {/* Thumbnail */}
                  <div className="relative pt-[56.25%] bg-surface-container-highest overflow-hidden">
                    {r.video_id ? (
                      <img
                        src={`https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`}
                        alt="" loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={e=>{e.target.style.display='none';}}
                      />
                    ) : null}
                    {!r.video_id && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon name={TYPE_ICON[r.result_type]||'video_library'} className="text-[36px] text-on-surface-variant/30"/>
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"/>
                    <span className="absolute top-1.5 left-1.5 chip-meta text-[9px] bg-black/60">{r.result_type}</span>
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <div className="text-body-sm font-medium text-on-surface leading-snug line-clamp-2 mb-1">{r.title||r.video_id||'—'}</div>
                    {r.author && <div className="text-label-xs text-on-surface-variant mb-2.5">{r.author}</div>}
                    {r.video_id && (
                      <div className="flex gap-1.5">
                        <a href={`https://youtube.com/watch?v=${r.video_id}`} target="_blank" rel="noreferrer"
                          className="btn-ghost rounded px-2 py-1 text-label-xs text-on-surface-variant no-underline flex items-center gap-1">
                          <Icon name="open_in_new" className="text-[11px]"/>Watch
                        </a>
                        <button
                          id={`dl-${r.video_id}`}
                          className={`rounded px-2 py-1 text-label-xs flex items-center gap-1 transition-all ${dlMap[r.video_id]==='done'?'btn-ghost text-green-400 border-green-500/30':dlMap[r.video_id]==='err'?'btn-ghost text-error border-error/30':'btn-primary text-white'}`}
                          onClick={()=>dlResult(r)} disabled={dlMap[r.video_id]==='loading'}>
                          {dlMap[r.video_id]==='loading'?<span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"/>
                            :dlMap[r.video_id]==='done'?<><Icon name="check" className="text-[11px]"/>Queued</>
                            :dlMap[r.video_id]==='err'?<><Icon name="close" className="text-[11px]"/>Error</>
                            :<><Icon name="download" className="text-[11px]"/>DL</>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!results && !loading && (
        <div className="flex flex-col items-center py-24 gap-4 text-on-surface-variant">
          <Icon name="search" className="text-[56px] opacity-20"/>
          <div className="text-headline-sm font-semibold text-on-surface/50">Search YouTube</div>
          <div className="text-body-sm">Find videos, channels, playlists and download directly</div>
        </div>
      )}
    </div>
  );
}
