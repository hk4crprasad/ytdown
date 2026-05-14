import { useState, useEffect } from 'react';
import { api } from './api';
import { QueueProvider, useQueue } from './context/QueueContext';
import VideoTab    from './tabs/VideoTab';
import PlaylistTab from './tabs/PlaylistTab';
import SearchTab   from './tabs/SearchTab';
import TokenTab    from './tabs/TokenTab';
import DownloadPopup from './components/DownloadPopup';
import './index.css';

const TABS = [
  { id: 'video',    label: '▶ Video' },
  { id: 'playlist', label: '📋 Playlist' },
  { id: 'search',   label: '🔍 Search' },
  { id: 'token',    label: '🔑 Token' },
];

function NavbarInner() {
  const { jobs } = useQueue();
  const activeCount = Object.values(jobs).filter(j => !['done','error'].includes(j.status)).length;
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <svg className="logo-icon" width="28" height="20" viewBox="0 0 28 20" fill="currentColor">
          <rect width="28" height="20" rx="4" fill="#FF0000"/>
          <polygon points="11,5 21,10 11,15" fill="white"/>
        </svg>
        <span>YTDown</span>
        <span className="logo-down">HD</span>
      </div>
      <div className="navbar-status">
        <div className="dot online" />
        <span>Ready</span>
        {activeCount > 0 && (
          <span style={{ background:'var(--red)', color:'#fff', borderRadius:'99px', padding:'0.1rem 0.55rem', fontSize:'0.72rem', fontWeight:700 }}>
            {activeCount} downloading
          </span>
        )}
      </div>
    </nav>
  );
}

function AppInner() {
  const [tab, setTab] = useState('video');
  const [heroUrl, setHeroUrl] = useState('');
  const [heroLoading, setHeroLoading] = useState(false);
  const [heroResult, setHeroResult] = useState(null);
  const [heroErr, setHeroErr] = useState('');
  const { startDownload } = useQueue();

  const heroLookup = async () => {
    if (!heroUrl.trim()) return;
    setHeroLoading(true); setHeroErr(''); setHeroResult(null);
    try {
      const info = await api.videoInfo(heroUrl);
      if (info.error) throw new Error(info.error.message);
      setHeroResult({ info, url: heroUrl });
    } catch(e) { setHeroErr(e.message || 'Failed to load video.'); }
    finally { setHeroLoading(false); }
  };

  return (
    <div className="app">
      <NavbarInner />

      {/* HERO */}
      <div className="hero">
        <div className="hero-title">Download Any YouTube Video</div>
        <div className="hero-sub">Free · Fast · HD · No watermarks · Works with playlists 🔥</div>
        <div className="hero-input-wrap">
          <input
            id="hero-url"
            className="hero-input"
            placeholder="Paste YouTube link here..."
            value={heroUrl}
            onChange={e => setHeroUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && heroLookup()}
          />
          <button className="hero-btn" onClick={heroLookup} disabled={heroLoading}>
            {heroLoading ? <span className="spinner" style={{borderColor:'rgba(204,0,0,0.2)', borderTopColor:'var(--red2)'}} /> : '⚡ Get'}
          </button>
        </div>
        {heroErr && <div style={{marginTop:'0.75rem',color:'#ffe0e0',fontSize:'0.85rem',position:'relative'}}>{heroErr}</div>}
      </div>

      <main className="main">
        {/* Quick result card from hero */}
        {heroResult && (
          <QuickCard info={heroResult.info} url={heroResult.url} onClear={() => setHeroResult(null)} />
        )}

        {/* Tab nav */}
        <div className="section-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`stab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'video'    && <VideoTab />}
        {tab === 'playlist' && <PlaylistTab />}
        {tab === 'search'   && <SearchTab />}
        {tab === 'token'    && <TokenTab />}
      </main>

      {/* Floating download popup */}
      <DownloadPopup />
    </div>
  );
}

function QuickCard({ info, url, onClear }) {
  const { startDownload } = useQueue();
  const [starting, setStarting] = useState('');

  const dl = async (label, opts) => {
    setStarting(label);
    try { await startDownload(url, opts); }
    catch(e) { alert(e.message); }
    finally { setStarting(''); }
  };

  return (
    <div className="video-card" style={{marginBottom:'1.5rem'}}>
      {info.thumbnail_url && <img className="video-card-thumb" src={info.thumbnail_url} alt="thumb" />}
      <div className="video-card-body">
        <div className="video-card-title">{info.title}</div>
        <div className="video-card-meta">
          <div className="meta-chip"><span className="meta-chip-key">Channel</span><span className="meta-chip-val">{info.author||'—'}</span></div>
          <div className="meta-chip"><span className="meta-chip-key">Views</span><span className="meta-chip-val">{info.views?Number(info.views).toLocaleString():'—'}</span></div>
          <div className="meta-chip"><span className="meta-chip-key">Duration</span><span className="meta-chip-val">{fmtDur(info.length_seconds)}</span></div>
        </div>
        <div className="action-row">
          <button className="btn btn-red" disabled={!!starting} onClick={() => dl('best',{title:info.title})}>
            {starting==='best'?<span className="spinner"/>:'⬇'} Best HD
          </button>
          <button className="btn btn-orange" disabled={!!starting} onClick={() => dl('mp3',{itag:'audio', title:info.title})}>
            {starting==='mp3'?<span className="spinner"/>:'🎵'} MP3
          </button>
          <button className="btn btn-ghost" onClick={onClear}>✕</button>
        </div>
      </div>
    </div>
  );
}

function fmtDur(s) {
  if (!s) return '—';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

export default function App() {
  return <QueueProvider><AppInner /></QueueProvider>;
}
