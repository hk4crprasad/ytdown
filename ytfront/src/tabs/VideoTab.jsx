import { useState } from 'react';
import { api } from '../api';
import { useQueue } from '../context/QueueContext';

function fmtDur(s) {
  if (!s) return '—';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

// Quality preset mapping
const QUALITY_PRESETS = ['4K','1440p','1080p','720p','480p','360p','240p','144p','MP3'];
const RES_MAP = {'4K':['2160p'],'1440p':['1440p'],'1080p':['1080p'],'720p':['720p'],'480p':['480p'],'360p':['360p'],'240p':['240p'],'144p':['144p']};

function getPresetsForStreams(allStreams) {
  const available = new Set();
  allStreams.forEach(s => {
    if (s.resolution) {
      QUALITY_PRESETS.forEach(p => {
        if (RES_MAP[p]?.includes(s.resolution)) available.add(p);
      });
    }
    if (s.includes_audio_track && !s.includes_video_track) available.add('MP3');
  });
  return QUALITY_PRESETS.filter(p => available.has(p));
}

function getBestItag(allStreams, quality) {
  if (quality === 'MP3') {
    const audioStreams = allStreams.filter(s => s.includes_audio_track && !s.includes_video_track);
    return audioStreams.sort((a,b) => (parseInt(b.abr)||0) - (parseInt(a.abr)||0))[0]?.itag;
  }
  const resTargets = RES_MAP[quality] || [];
  // prefer adaptive video (better quality, will be merged)
  const videoStreams = allStreams.filter(s => s.includes_video_track && !s.includes_audio_track && resTargets.includes(s.resolution));
  // prefer H.264 for compatibility, then AV1
  const h264 = videoStreams.find(s => s.video_codec?.startsWith('avc1'));
  const av1  = videoStreams.find(s => s.video_codec?.startsWith('av01'));
  return (h264 || av1 || videoStreams[0])?.itag;
}

function StreamRow({ s, selected, onSelect }) {
  const isAudio = !s.includes_video_track;
  const isVideo = !s.includes_audio_track && s.includes_video_track;
  const isProg  = s.is_progressive;
  return (
    <tr className={selected ? 'selected' : ''} style={{cursor:'pointer'}} onClick={() => onSelect(s)}>
      <td><span className="codec">{s.itag}</span></td>
      <td>
        {isProg  && <span className="badge badge-prog">Progressive</span>}
        {!isProg && isAudio && <span className="badge badge-audio">Audio Only</span>}
        {!isProg && isVideo && <span className="badge badge-video">Video Only</span>}
        {!isProg && !isAudio && !isVideo && <span className="badge badge-adap">Adaptive</span>}
      </td>
      <td><strong>{s.resolution || '—'}</strong></td>
      <td><span className="codec">{s.video_codec || '—'}</span></td>
      <td><span className="codec">{s.audio_codec || '—'}</span></td>
      <td>{s.abr || '—'}</td>
      <td>{s.subtype}</td>
      <td style={{color:'var(--text2)',fontWeight:600}}>{s.filesize_mb ? `${s.filesize_mb} MB` : '—'}</td>
    </tr>
  );
}

// Copy text to clipboard
function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

export default function VideoTab() {
  const [url, setUrl]           = useState('');
  const [info, setInfo]         = useState(null);
  const [streams, setStreams]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [captions, setCaptions] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');
  const [dlErr, setDlErr]       = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const [dlLoading, setDlLoading] = useState('');
  const [copied, setCopied]     = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [captionLoading, setCaptionLoading] = useState(false);
  const { startDownload }       = useQueue();

  const lookup = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setInfo(null); setStreams(null);
    setSelected(null); setSelectedQuality(null); setCaptions(null); setDlErr('');
    try {
      const [infoRes, streamsRes] = await Promise.all([
        api.videoInfo(url), api.videoStreams(url),
      ]);
      if (infoRes.error) throw new Error(infoRes.error.message);
      setInfo(infoRes); setStreams(streamsRes);
    } catch(e) { setErr(e.message || 'Failed to load.'); }
    finally { setLoading(false); }
  };

  const handleDownload = async (mode = 'selected') => {
    if (!info) return;
    setDlLoading(mode); setDlErr('');
    try {
      let params = { title: info.title };
      if (mode === 'best') {
        // auto best (no itag)
      } else if (mode === 'mp3') {
        // pick best audio itag
        const audioStreams = (streams?.all_streams || []).filter(s => s.includes_audio_track && !s.includes_video_track);
        const best = audioStreams.sort((a,b)=>(parseInt(b.abr)||0)-(parseInt(a.abr)||0))[0];
        if (best) params.itag = best.itag;
      } else if (mode === 'quality' && selectedQuality) {
        const itag = getBestItag(streams?.all_streams || [], selectedQuality);
        if (itag) params.itag = itag;
      } else if (mode === 'selected' && selected) {
        params.itag = selected.itag;
      }
      await startDownload(url, params);
    } catch(e) {
      setDlErr(e.message || 'Failed to start download.');
    } finally {
      setDlLoading('');
    }
  };

  const loadCaptions = async () => {
    if (captions) { setShowCaptions(v => !v); return; }
    setCaptionLoading(true);
    try {
      const res = await api.captionsList(url);
      setCaptions(res.captions || []);
      setShowCaptions(true);
    } catch { setCaptions([]); }
    finally { setCaptionLoading(false); }
  };

  const availablePresets = streams ? getPresetsForStreams(streams.all_streams || []) : [];

  const visibleStreams = () => {
    if (!streams) return [];
    const all = streams.all_streams || [];
    if (activeSection === 'progressive') return all.filter(s => s.is_progressive);
    if (activeSection === 'video')       return all.filter(s => s.includes_video_track && !s.includes_audio_track);
    if (activeSection === 'audio')       return all.filter(s => s.includes_audio_track && !s.includes_video_track);
    return all;
  };

  return (
    <>
      {/* URL input */}
      <div className="card" style={{marginBottom:'1.2rem'}}>
        <div className="card-title" style={{marginBottom:'0.75rem'}}>🎬 Video Downloader</div>
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
          <input
            id="video-url-input"
            style={{
              flex:1, minWidth:260, padding:'0.7rem 1rem',
              border:'2px solid var(--border)', borderRadius:'var(--radius-pill)',
              fontFamily:'Inter,sans-serif', fontSize:'0.9rem', outline:'none',
              transition:'border-color 0.15s',
            }}
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key==='Enter' && lookup()}
            onFocus={e => e.target.style.borderColor='var(--red)'}
            onBlur={e => e.target.style.borderColor='var(--border)'}
          />
          <button id="video-lookup-btn" className="btn btn-red" onClick={lookup} disabled={loading}>
            {loading ? <span className="spinner" style={{borderColor:'rgba(255,255,255,0.3)',borderTopColor:'#fff'}}/> : '⚡ Inspect'}
          </button>
        </div>
      </div>

      {err && <div className="alert alert-error">⚠ {err}</div>}
      {dlErr && <div className="alert alert-error">⚠ {dlErr}</div>}

      {/* Video Info Card */}
      {info && (
        <div className="video-card" id="video-info-card">
          {info.thumbnail_url && (
            <img className="video-card-thumb" src={info.thumbnail_url} alt="thumbnail" />
          )}
          <div className="video-card-body">
            <div className="video-card-title">{info.title}</div>
            <div className="video-card-meta">
              <div className="meta-chip"><span className="meta-chip-key">Channel</span><span className="meta-chip-val">{info.author||'—'}</span></div>
              <div className="meta-chip"><span className="meta-chip-key">Duration</span><span className="meta-chip-val">{fmtDur(info.length_seconds)}</span></div>
              <div className="meta-chip"><span className="meta-chip-key">Views</span><span className="meta-chip-val">{info.views?Number(info.views).toLocaleString():'—'}</span></div>
              <div className="meta-chip"><span className="meta-chip-key">Published</span><span className="meta-chip-val">{info.publish_date?.slice(0,10)||'—'}</span></div>
              <div className="meta-chip"><span className="meta-chip-key">Streams</span><span className="meta-chip-val">{info.stream_count}</span></div>
            </div>

            {/* Quality picker chips */}
            {availablePresets.length > 0 && (
              <div style={{marginBottom:'1rem'}}>
                <div className="card-title" style={{marginBottom:'0.5rem'}}>Select Quality</div>
                <div className="quality-row">
                  {availablePresets.map(p => (
                    <button
                      key={p}
                      className={`quality-chip ${p==='1080p'||p==='4K'?'best':''} ${selectedQuality===p?'active':''}`}
                      onClick={() => { setSelectedQuality(p); setSelected(null); }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="action-row">
              <button id="dl-best-btn" className="btn btn-red" disabled={!!dlLoading} onClick={() => handleDownload(selectedQuality ? 'quality' : 'best')}>
                {dlLoading==='best'||dlLoading==='quality' ? <span className="spinner" style={{borderColor:'rgba(255,255,255,0.3)',borderTopColor:'#fff'}}/> : '⬇'}
                {selectedQuality ? `Download ${selectedQuality}` : 'Best Quality'}
              </button>
              <button id="dl-mp3-btn" className="btn btn-orange" disabled={!!dlLoading} onClick={() => handleDownload('mp3')}>
                {dlLoading==='mp3'?<span className="spinner"/>:'🎵'} MP3
              </button>
              {selected && (
                <button id="dl-selected-btn" className="btn btn-purple" disabled={!!dlLoading} onClick={() => handleDownload('selected')}>
                  {dlLoading==='selected'?<span className="spinner"/>:'⬇'} itag {selected.itag}
                  {selected.resolution && ` (${selected.resolution})`}
                </button>
              )}
              <button
                className="btn btn-ghost"
                onClick={loadCaptions}
                disabled={captionLoading}
              >
                {captionLoading ? <span className="spinner"/> : '💬'} Captions
              </button>
              <button
                className="btn btn-ghost"
                title="Copy page URL"
                onClick={() => { copyToClipboard(url); setCopied(true); setTimeout(()=>setCopied(false),1500); }}
              >
                {copied ? '✓ Copied' : '🔗 Copy'}
              </button>
            </div>

            {/* Captions panel */}
            {showCaptions && captions !== null && (
              <div style={{marginTop:'1rem', background:'var(--bg2)', borderRadius:'var(--radius)', padding:'0.8rem'}}>
                <div className="card-title" style={{marginBottom:'0.5rem'}}>Available Captions ({captions.length})</div>
                {captions.length === 0 ? <span style={{fontSize:'0.82rem',color:'var(--text3)'}}>No captions available</span> : (
                  captions.map(c => (
                    <div key={c.code} className="caption-item">
                      <span style={{fontSize:'0.82rem',fontWeight:600}}>{c.name} <span style={{color:'var(--text3)',fontWeight:400}}>({c.code})</span></span>
                      <div style={{display:'flex',gap:'0.3rem'}}>
                        {['srt','txt','xml'].map(fmt => (
                          <a key={fmt}
                            className="btn btn-xs btn-ghost"
                            href={`http://localhost:8000/captions/download?url=${encodeURIComponent(url)}&lang_code=${c.code}&fmt=${fmt}&raw=true`}
                            target="_blank" rel="noreferrer"
                            style={{textDecoration:'none'}}
                          >.{fmt}</a>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stream Table */}
      {streams && (
        <div className="card" id="streams-card">
          <div className="card-header">
            <span className="card-title">All Streams — {streams.total} total</span>
            {selected && (
              <span style={{fontSize:'0.78rem',color:'var(--text2)'}}>
                Selected: itag <strong style={{color:'var(--red)'}}>{selected.itag}</strong>
                {selected.includes_video_track && !selected.includes_audio_track &&
                  <span style={{color:'var(--text3)',marginLeft:6,fontSize:'0.72rem'}}>(auto-merges audio)</span>}
              </span>
            )}
          </div>

          <div style={{display:'flex',gap:'0.25rem',background:'var(--bg2)',borderRadius:'var(--radius-pill)',padding:'3px',marginBottom:'1rem',overflowX:'auto'}}>
            {[
              ['all',`All (${streams.total})`],
              ['progressive',`Progressive (${streams.progressive?.length})`],
              ['video',`Video-only (${streams.video_only?.length})`],
              ['audio',`Audio-only (${streams.audio_only?.length})`],
            ].map(([k,label]) => (
              <button key={k}
                style={{
                  padding:'0.4rem 1rem', borderRadius:'var(--radius-pill)', border:'none',
                  fontSize:'0.78rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
                  background: activeSection===k ? '#fff' : 'transparent',
                  color: activeSection===k ? 'var(--text)' : 'var(--text3)',
                  boxShadow: activeSection===k ? 'var(--shadow)' : 'none',
                  transition:'all 0.15s',
                }}
                onClick={() => setActiveSection(k)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="stream-wrap">
            <table className="stream-table">
              <thead>
                <tr><th>Itag</th><th>Type</th><th>Res</th><th>Video Codec</th><th>Audio Codec</th><th>ABR</th><th>Fmt</th><th>Size</th></tr>
              </thead>
              <tbody>
                {visibleStreams().map(s => (
                  <StreamRow key={s.itag} s={s} selected={selected?.itag===s.itag} onSelect={setSelected} />
                ))}
              </tbody>
            </table>
          </div>

          {activeSection==='video' && (
            <div className="alert alert-info" style={{marginTop:'0.75rem'}}>
              💡 Video-only streams are merged with the best audio using ffmpeg on the server. Watch progress in the popup ↘
            </div>
          )}
        </div>
      )}
    </>
  );
}
