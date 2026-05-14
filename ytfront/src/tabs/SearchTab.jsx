import { useState } from 'react';
import { api } from '../api';

const TYPE_OPTS    = ['', 'video', 'channel', 'playlist', 'movie'];
const DATE_OPTS    = ['', 'hour', 'today', 'week', 'month', 'year'];
const DUR_OPTS     = ['', 'short', 'medium', 'long'];
const SORT_OPTS    = ['', 'relevance', 'date', 'views', 'rating'];

export default function SearchTab() {
  const [q, setQ]           = useState('');
  const [filters, setFilters] = useState({ result_type:'', upload_date:'', duration:'', sort_by:'' });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [page, setPage]       = useState(1);
  const [activeType, setActiveType] = useState('videos');

  const doSearch = async (p = 1) => {
    if (!q.trim()) return;
    setLoading(true); setErr('');
    try {
      const opts = { page: p };
      Object.entries(filters).forEach(([k, v]) => { if (v) opts[k] = v; });
      const res = await api.search(q, opts);
      if (res.error) throw new Error(res.error.message);
      setResults(res); setPage(p);
    } catch(e) {
      setErr(e.message || 'Search failed.');
    } finally { setLoading(false); }
  };

  const openVideo = (vid) => window.open(`https://youtube.com/watch?v=${vid}`, '_blank');

  const resultSets = results ? {
    videos: results.videos || [],
    shorts: results.shorts || [],
    playlists: results.playlists || [],
    channels: results.channels || [],
  } : {};

  const counts = results ? Object.entries(resultSets).map(([k,v]) => `${k}: ${v.length}`).join(' · ') : '';

  return (
    <>
      <h1 className="section-title">YouTube Search</h1>
      <p className="section-sub">Search with filters — type, duration, upload date, sort order.</p>

      <div className="search-wrap">
        <div className="search-label">Query</div>
        <div className="search-row">
          <input
            id="search-input"
            className="search-input"
            placeholder="e.g. Python tutorial, lo-fi beats, React crash course..."
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch(1)}
          />
          <button id="search-btn" className="btn btn-primary" onClick={() => doSearch(1)} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Search'}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Type', key: 'result_type', opts: TYPE_OPTS },
            { label: 'Date',  key: 'upload_date', opts: DATE_OPTS },
            { label: 'Duration', key: 'duration', opts: DUR_OPTS },
            { label: 'Sort', key: 'sort_by', opts: SORT_OPTS },
          ].map(({ label, key, opts }) => (
            <div key={key}>
              <div className="meta-key" style={{ marginBottom: 4 }}>{label}</div>
              <select
                id={`filter-${key}`}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text2)', padding: '0.45rem 0.75rem',
                  fontSize: '0.82rem', cursor: 'pointer', outline: 'none',
                }}
                value={filters[key]}
                onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
              >
                {opts.map(o => <option key={o} value={o}>{o || `Any ${label}`}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {err && <div className="alert alert-error">⚠ {err}</div>}

      {results && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
              {counts} &nbsp;·&nbsp; Suggestions: {results.suggestions?.slice(0,3).join(', ') || 'none'}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => doSearch(page - 1)} disabled={page <= 1 || loading}>← Prev</button>
              <button className="btn btn-ghost btn-sm" onClick={() => doSearch(page + 1)} disabled={loading}>Next →</button>
            </div>
          </div>

          <div className="tabs" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
            {Object.entries(resultSets).map(([k, v]) => (
              <button key={k} className={`tab ${activeType === k ? 'active' : ''}`} onClick={() => setActiveType(k)}>
                {k.charAt(0).toUpperCase() + k.slice(1)} ({v.length})
              </button>
            ))}
          </div>

          {resultSets[activeType]?.length === 0 ? (
            <div className="empty"><p>No {activeType} found for this query.</p></div>
          ) : (
            <div className="results-grid" id={`results-${activeType}`}>
              {resultSets[activeType].map(r => (
                <div
                  key={r.video_id || r.url}
                  className="result-card"
                  id={`result-${r.video_id}`}
                  onClick={() => r.video_id && openVideo(r.video_id)}
                >
                  <div className="result-type-chip">{r.result_type}</div>
                  {r.title && <div style={{ fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.4, marginBottom: '0.3rem' }}>{r.title}</div>}
                  <div className="result-vid-id">{r.video_id || '—'}</div>
                  {r.author && <div className="result-author">{r.author}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!results && !loading && (
        <div className="empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p>Search YouTube above to see results here</p>
        </div>
      )}
    </>
  );
}
