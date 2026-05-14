import { useState } from 'react';
import { api } from '../api';
import { useQueue } from '../context/QueueContext';
import DownloadQueue from '../components/DownloadQueue';

function fmtDur(s) {
  if (!s) return '—';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}
function fmtNum(n) { return n ? Number(n).toLocaleString() : '—'; }

function StreamRow({ s, selected, onSelect }) {
  const isAudio = !s.includes_video_track;
  const isVideo = !s.includes_audio_track && s.includes_video_track;
  const isProg  = s.is_progressive;
  return (
    <tr className={selected ? 'selected' : ''} style={{ cursor: 'pointer' }} onClick={() => onSelect(s)}>
      <td><span className="codec">{s.itag}</span></td>
      <td>
        {isProg  && <span className="badge badge-prog">Progressive</span>}
        {!isProg && isAudio && <span className="badge badge-audio">Audio</span>}
        {!isProg && isVideo && <span className="badge badge-video">Video</span>}
        {!isProg && !isAudio && !isVideo && <span className="badge badge-adap">Adaptive</span>}
      </td>
      <td>{s.resolution || '—'}</td>
      <td><span className="codec">{s.video_codec || '—'}</span></td>
      <td><span className="codec">{s.audio_codec || '—'}</span></td>
      <td>{s.abr || '—'}</td>
      <td>{s.subtype}</td>
      <td>{s.filesize_mb ? `${s.filesize_mb} MB` : '—'}</td>
    </tr>
  );
}

export default function VideoTab() {
  const [url, setUrl]         = useState('');
  const [info, setInfo]       = useState(null);
  const [streams, setStreams] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dlLoading, setDlLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [dlErr, setDlErr]     = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const { startDownload }     = useQueue();

  const lookup = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setInfo(null); setStreams(null); setSelected(null); setDlErr('');
    try {
      const [infoRes, streamsRes] = await Promise.all([
        api.videoInfo(url), api.videoStreams(url),
      ]);
      if (infoRes.error) throw new Error(infoRes.error.message);
      setInfo(infoRes); setStreams(streamsRes);
    } catch(e) { setErr(e.message || 'Failed.'); }
    finally { setLoading(false); }
  };

  const handleDownload = async () => {
    if (!info) return;
    setDlLoading(true); setDlErr('');
    try {
      await startDownload(url, selected ? { itag: selected.itag, title: info.title, resolution: selected.resolution, video_codec: selected.video_codec } : { title: info.title });
    } catch(e) {
      setDlErr(e.message || 'Failed to start download.');
    } finally {
      setDlLoading(false);
    }
  };

  const visibleStreams = () => {
    if (!streams) return [];
    const all = streams.all_streams || [];
    if (activeSection === 'progressive') return all.filter(s => s.is_progressive);
    if (activeSection === 'video')  return all.filter(s => s.includes_video_track && !s.includes_audio_track);
    if (activeSection === 'audio')  return all.filter(s => s.includes_audio_track && !s.includes_video_track);
    return all;
  };

  return (
    <>
      <h1 className="section-title">Video Inspector</h1>
      <p className="section-sub">Paste a YouTube URL to inspect streams, codecs, and download with real-time progress.</p>

      <div className="search-wrap">
        <div className="search-label">YouTube URL</div>
        <div className="search-row">
          <input id="video-url-input" className="search-input"
            placeholder="https://youtube.com/watch?v=... or youtu.be/..."
            value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()} />
          <button id="video-lookup-btn" className="btn btn-primary" onClick={lookup} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Inspect'}
          </button>
        </div>
      </div>

      {err && <div className="alert alert-error">⚠ {err}</div>}
      {dlErr && <div className="alert alert-error">⚠ {dlErr}</div>}

      {info && (
        <div className="card" id="video-info-card">
          <div className="card-header"><span className="card-title">Video Info</span></div>
          <div className="video-meta">
            {info.thumbnail_url
              ? <img className="video-thumb" src={info.thumbnail_url} alt="thumb" />
              : <div className="video-thumb-placeholder">No thumb</div>}
            <div className="video-details">
              <div className="video-title" title={info.title}>{info.title}</div>
              <div className="video-meta-row">
                <div className="meta-item"><span className="meta-key">Channel</span><span className="meta-val">{info.author||'—'}</span></div>
                <div className="meta-item"><span className="meta-key">Duration</span><span className="meta-val">{fmtDur(info.length_seconds)}</span></div>
                <div className="meta-item"><span className="meta-key">Views</span><span className="meta-val">{fmtNum(info.views)}</span></div>
                <div className="meta-item"><span className="meta-key">Streams</span><span className="meta-val">{info.stream_count}</span></div>
                <div className="meta-item"><span className="meta-key">Published</span><span className="meta-val">{info.publish_date?.slice(0,10)||'—'}</span></div>
              </div>

              {/* Quick download buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  id="dl-best-btn"
                  className="btn btn-primary btn-sm"
                  onClick={handleDownload}
                  disabled={dlLoading}
                  title="Download best resolution (adaptive → auto-merged)"
                >
                  {dlLoading ? <span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> : '⬇ Best Quality'}
                </button>
                {selected && (
                  <button
                    id="dl-selected-btn"
                    className="btn btn-sm btn-success"
                    onClick={handleDownload}
                    disabled={dlLoading}
                  >
                    ⬇ itag {selected.itag} ({selected.resolution || selected.abr || selected.subtype})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {streams && (
        <div className="card" id="streams-card">
          <div className="card-header">
            <span className="card-title">Streams — {streams.total} total</span>
            {selected && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>
                itag <strong style={{ color: 'var(--accent2)' }}>{selected.itag}</strong> selected
                {selected.includes_video_track && !selected.includes_audio_track &&
                  <span style={{ color: 'var(--text3)', marginLeft: 6 }}>(will auto-merge audio)</span>}
              </span>
            )}
          </div>

          <div className="tabs" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
            {[
              ['all', `All (${streams.total})`],
              ['progressive', `Progressive (${streams.progressive?.length})`],
              ['video', `Video-only (${streams.video_only?.length})`],
              ['audio', `Audio-only (${streams.audio_only?.length})`],
            ].map(([k, label]) => (
              <button key={k} className={`tab ${activeSection===k?'active':''}`} onClick={() => setActiveSection(k)}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="stream-table">
              <thead>
                <tr><th>Itag</th><th>Type</th><th>Res</th><th>Video Codec</th><th>Audio Codec</th><th>ABR</th><th>Fmt</th><th>Size</th></tr>
              </thead>
              <tbody>
                {visibleStreams().map(s => (
                  <StreamRow key={s.itag} s={s} selected={selected?.itag === s.itag} onSelect={setSelected} />
                ))}
              </tbody>
            </table>
          </div>

          {activeSection === 'video' && (
            <div className="alert alert-info" style={{ marginTop: '0.75rem' }}>
              💡 Video-only streams are merged with the best audio via ffmpeg on the server. Progress shown below.
            </div>
          )}
        </div>
      )}

      {/* Live download queue — shown below streams */}
      <DownloadQueue />
    </>
  );
}
