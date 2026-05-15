import { useState, useEffect } from 'react';
import { api } from '../api';
import { useQueue } from '../context/QueueContext';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined leading-none ${className}`}>{name}</span>;
}

function fmtDur(s) {
  if (!s) return '—';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

const QUALITY_PRESETS = ['4K','1440p','1080p','720p','480p','360p','240p','144p','MP3'];
const RES_MAP = {'4K':['2160p'],'1440p':['1440p'],'1080p':['1080p'],'720p':['720p'],'480p':['480p'],'360p':['360p'],'240p':['240p'],'144p':['144p']};

function getPresets(streams) {
  const avail = new Set();
  streams.forEach(s => {
    if (s.resolution) QUALITY_PRESETS.forEach(p => { if (RES_MAP[p]?.includes(s.resolution)) avail.add(p); });
    if (s.includes_audio_track && !s.includes_video_track) avail.add('MP3');
  });
  return QUALITY_PRESETS.filter(p => avail.has(p));
}

function getBestItag(streams, quality) {
  if (quality === 'MP3') {
    const a = streams.filter(s => s.includes_audio_track && !s.includes_video_track);
    return a.sort((a,b)=>(parseInt(b.abr)||0)-(parseInt(a.abr)||0))[0]?.itag;
  }
  const targets = RES_MAP[quality] || [];
  const vids = streams.filter(s => s.includes_video_track && !s.includes_audio_track && targets.includes(s.resolution));
  return (vids.find(s=>s.video_codec?.startsWith('avc1')) || vids[0])?.itag;
}

const STREAM_SECTIONS = [
  ['all', 'All'],
  ['progressive', 'Progressive'],
  ['video', 'Video Only'],
  ['audio', 'Audio Only'],
];

export default function VideoTab({ initialUrl = '' }) {
  const [url, setUrl]             = useState(initialUrl);
  const [info, setInfo]           = useState(null);
  const [streams, setStreams]     = useState(null);
  const [selected, setSelected]   = useState(null);
  const [selQuality, setSelQuality] = useState(null);
  const [captions, setCaptions]   = useState(null);
  const [showCaptions, setShowCaptions] = useState(false);
  const [section, setSection]     = useState('all');
  const [loading, setLoading]     = useState(false);
  const [dlLoading, setDlLoading] = useState('');
  const [captLoading, setCaptLoading] = useState(false);
  const [err, setErr]             = useState('');
  const [dlErr, setDlErr]         = useState('');
  const [copied, setCopied]       = useState(false);
  const { startDownload } = useQueue();

  const doLookup = async (target) => {
    if (!target?.trim()) return;
    setLoading(true); setErr(''); setInfo(null); setStreams(null);
    setSelected(null); setSelQuality(null); setCaptions(null); setDlErr('');
    try {
      const [infoRes, streamRes] = await Promise.all([api.videoInfo(target), api.videoStreams(target)]);
      if (infoRes.error) throw new Error(infoRes.error.message);
      setInfo(infoRes); setStreams(streamRes);
    } catch(e) { setErr(e.message || 'Failed to load video.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (initialUrl) doLookup(initialUrl); }, []);

  const handleDl = async (mode) => {
    if (!info) return;
    setDlLoading(mode); setDlErr('');
    try {
      const params = { title: info.title };
      if (mode === 'mp3') {
        const best = (streams?.all_streams||[]).filter(s=>s.includes_audio_track&&!s.includes_video_track)
          .sort((a,b)=>(parseInt(b.abr)||0)-(parseInt(a.abr)||0))[0];
        if (best) params.itag = best.itag;
      } else if (mode === 'quality' && selQuality) {
        const itag = getBestItag(streams?.all_streams||[], selQuality);
        if (itag) params.itag = itag;
      } else if (mode === 'selected' && selected) {
        params.itag = selected.itag;
      }
      await startDownload(url, params);
    } catch(e) { setDlErr(e.message || 'Download failed.'); }
    finally { setDlLoading(''); }
  };

  const loadCaptions = async () => {
    if (captions) { setShowCaptions(v=>!v); return; }
    setCaptLoading(true);
    try { const r = await api.captionsList(url); setCaptions(r.captions||[]); setShowCaptions(true); }
    catch { setCaptions([]); }
    finally { setCaptLoading(false); }
  };

  const presets = streams ? getPresets(streams.all_streams||[]) : [];
  const visibleStreams = () => {
    const all = streams?.all_streams || [];
    if (section==='progressive') return all.filter(s=>s.is_progressive);
    if (section==='video')       return all.filter(s=>s.includes_video_track&&!s.includes_audio_track);
    if (section==='audio')       return all.filter(s=>s.includes_audio_track&&!s.includes_video_track);
    return all;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* URL input */}
      <div className="glass-panel glass-panel-border rounded-xl p-5">
        <div className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-3">Video Downloader</div>
        <div className="flex gap-3 flex-wrap">
          <input
            className="input-recessed flex-1 min-w-60 rounded-lg px-4 py-2.5 text-body-sm"
            placeholder="https://youtube.com/watch?v=..."
            value={url} onChange={e=>setUrl(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&doLookup(url)}
          />
          <button className="btn-primary rounded-lg px-5 py-2.5 text-white text-label-sm uppercase tracking-wider flex items-center gap-2"
            onClick={()=>doLookup(url)} disabled={loading}>
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/> : <Icon name="bolt" className="text-[16px]"/>}
            Inspect
          </button>
        </div>
      </div>

      {err  && <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border-error/30 text-error text-body-sm"><Icon name="error" className="text-[18px]"/>{err}</div>}
      {dlErr && <div className="glass-panel rounded-xl px-4 py-3 flex items-center gap-3 border-error/30 text-error text-body-sm"><Icon name="error" className="text-[18px]"/>{dlErr}</div>}

      {/* Video info card */}
      {info && (
        <div className="glass-panel glass-panel-border rounded-xl overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {info.thumbnail_url && (
              <div className="md:w-72 flex-shrink-0 relative">
                <img src={info.thumbnail_url} alt="" className="w-full h-full object-cover" style={{minHeight:152}} />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/60 hidden md:block" />
                {/* Scanning line */}
                <div className="absolute left-0 right-0 h-[2px] bg-primary/60 shadow-[0_0_10px_#ddb7ff] animate-scan" />
              </div>
            )}
            <div className="flex-1 p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-headline-sm text-on-surface leading-snug">{info.title}</h2>
                <span className="chip-meta flex-shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow"/>Loaded
                </span>
              </div>

              {/* Meta chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[['Channel',info.author||'—'],['Duration',fmtDur(info.length_seconds)],['Views',info.views?Number(info.views).toLocaleString():'—'],['Streams',info.stream_count]].map(([k,v])=>(
                  <div key={k} className="bg-surface-container rounded-lg p-3 border border-white/[0.06]">
                    <div className="text-label-xs text-on-surface-variant mb-1">{k}</div>
                    <div className="text-body-sm font-semibold text-on-surface truncate">{v}</div>
                  </div>
                ))}
              </div>

              {/* Quality picker */}
              {presets.length > 0 && (
                <div className="mb-5">
                  <div className="text-label-xs text-on-surface-variant uppercase tracking-wider mb-2">Quality</div>
                  <div className="flex flex-wrap gap-2">
                    {presets.map(p => (
                      <button key={p} onClick={()=>{setSelQuality(p);setSelected(null);}}
                        className={`px-3 py-1 rounded-full text-label-sm border transition-all ${selQuality===p ? 'bg-primary/20 border-primary text-primary' : 'border-outline-variant/50 text-on-surface-variant hover:border-primary/50 hover:text-primary/80'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary rounded-lg px-4 py-2 text-white text-label-sm uppercase tracking-wider flex items-center gap-2"
                  disabled={!!dlLoading} onClick={()=>handleDl(selQuality?'quality':'best')}>
                  {dlLoading==='best'||dlLoading==='quality' ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Icon name="download" className="text-[16px]"/>}
                  {selQuality?`Download ${selQuality}`:'Best Quality'}
                </button>
                <button className="btn-ghost rounded-lg px-4 py-2 text-on-surface-variant text-label-sm uppercase tracking-wider flex items-center gap-2"
                  disabled={!!dlLoading} onClick={()=>handleDl('mp3')}>
                  <Icon name="music_note" className="text-[16px]"/>MP3
                </button>
                {selected && (
                  <button className="btn-ghost rounded-lg px-4 py-2 text-secondary text-label-sm uppercase tracking-wider flex items-center gap-2 border-secondary/30"
                    disabled={!!dlLoading} onClick={()=>handleDl('selected')}>
                    <Icon name="download" className="text-[16px]"/>itag {selected.itag}
                  </button>
                )}
                <button className="btn-ghost rounded-lg px-3 py-2 text-on-surface-variant text-label-sm flex items-center gap-1.5"
                  onClick={loadCaptions} disabled={captLoading}>
                  {captLoading?<span className="w-3.5 h-3.5 border-2 border-outline-variant border-t-primary rounded-full animate-spin"/>:<Icon name="subtitles" className="text-[16px]"/>}
                  Captions
                </button>
                <button className="btn-ghost rounded-lg px-3 py-2 text-on-surface-variant text-label-sm flex items-center gap-1.5"
                  onClick={()=>{navigator.clipboard?.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1500);}}>
                  <Icon name={copied?'check':'content_copy'} className="text-[16px]"/>
                  {copied?'Copied':'Copy'}
                </button>
              </div>

              {/* Captions */}
              {showCaptions && captions && (
                <div className="mt-4 bg-surface-container rounded-xl border border-white/[0.06] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/[0.06] text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Captions ({captions.length})
                  </div>
                  {captions.length === 0 ? (
                    <div className="px-4 py-3 text-body-sm text-on-surface-variant">No captions available</div>
                  ) : captions.map(c=>(
                    <div key={c.code} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03]">
                      <span className="text-body-sm text-on-surface">{c.name} <span className="text-on-surface-variant">({c.code})</span></span>
                      <div className="flex gap-1.5">
                        {['srt','txt','xml'].map(fmt=>(
                          <a key={fmt} href={`http://localhost:8000/captions/download?url=${encodeURIComponent(url)}&lang_code=${c.code}&fmt=${fmt}&raw=true`}
                            target="_blank" rel="noreferrer"
                            className="btn-ghost rounded px-2.5 py-1 text-label-xs text-on-surface-variant no-underline">.{fmt}</a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Streams table */}
      {streams && (
        <div className="glass-panel glass-panel-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Streams — {streams.total} total</span>
            {selected && (
              <span className="chip-meta">Selected itag {selected.itag}{selected.resolution&&` · ${selected.resolution}`}</span>
            )}
          </div>
          {/* Section switcher */}
          <div className="flex gap-1 p-3 border-b border-white/[0.06] overflow-x-auto">
            {STREAM_SECTIONS.map(([k,label])=>(
              <button key={k} onClick={()=>setSection(k)}
                className={`px-4 py-1.5 rounded-full text-label-sm transition-all ${section===k?'bg-primary/15 text-primary border border-primary/30':'text-on-surface-variant hover:text-on-surface border border-transparent'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm border-collapse">
              <thead>
                <tr>
                  {['Itag','Type','Res','Video Codec','Audio Codec','ABR','Fmt','Size'].map(h=>(
                    <th key={h} className="text-left px-4 py-2.5 text-label-xs text-on-surface-variant uppercase tracking-wider border-b border-white/[0.06] font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleStreams().map(s => {
                  const isAudio = !s.includes_video_track;
                  const isVideo = !s.includes_audio_track && s.includes_video_track;
                  const isProg  = s.is_progressive;
                  return (
                    <tr key={s.itag} onClick={()=>setSelected(s)}
                      className={`stream-row border-b border-white/[0.04] last:border-0 cursor-pointer ${selected?.itag===s.itag?'selected':''}`}>
                      <td className="px-4 py-2.5"><span className="font-mono text-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">{s.itag}</span></td>
                      <td className="px-4 py-2.5">
                        {isProg   && <span className="chip-meta bg-green-500/10 text-green-400">Progressive</span>}
                        {!isProg&&isAudio && <span className="chip-meta bg-secondary/10 text-secondary">Audio</span>}
                        {!isProg&&isVideo && <span className="chip-meta bg-primary/10 text-primary">Video</span>}
                        {!isProg&&!isAudio&&!isVideo && <span className="chip-meta bg-tertiary/10 text-tertiary">Adaptive</span>}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-on-surface">{s.resolution||'—'}</td>
                      <td className="px-4 py-2.5 font-mono text-label-sm text-on-surface-variant">{s.video_codec||'—'}</td>
                      <td className="px-4 py-2.5 font-mono text-label-sm text-on-surface-variant">{s.audio_codec||'—'}</td>
                      <td className="px-4 py-2.5 text-on-surface-variant">{s.abr||'—'}</td>
                      <td className="px-4 py-2.5 text-on-surface-variant">{s.subtype}</td>
                      <td className="px-4 py-2.5 text-on-surface font-semibold">{s.filesize_mb?`${s.filesize_mb} MB`:'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {section==='video' && (
            <div className="px-5 py-3 border-t border-white/[0.06] flex items-center gap-2 text-secondary text-body-sm">
              <Icon name="info" className="text-[16px]"/>
              Video-only streams are auto-merged with best audio via FFmpeg on the server.
            </div>
          )}
        </div>
      )}

      {!info && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-on-surface-variant">
          <Icon name="smart_display" className="text-[56px] opacity-20"/>
          <div className="text-headline-sm font-semibold text-on-surface/50">Paste a YouTube URL above</div>
          <div className="text-body-sm">Inspect streams, pick quality, download video or audio</div>
        </div>
      )}
    </div>
  );
}
