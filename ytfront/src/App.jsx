import { useState } from 'react';
import { QueueProvider, useQueue } from './context/QueueContext';
import VideoTab    from './tabs/VideoTab';
import PlaylistTab from './tabs/PlaylistTab';
import SearchTab   from './tabs/SearchTab';
import TokenTab    from './tabs/TokenTab';
import DownloadPanel from './components/DownloadPanel';

const NAV = [
  { id: 'video',    label: 'Video',    icon: 'smart_display' },
  { id: 'playlist', label: 'Playlist', icon: 'queue_music' },
  { id: 'search',   label: 'Search',   icon: 'search' },
  { id: 'token',    label: 'Auth Token',icon: 'key' },
];

function detectType(val) {
  if (!val.trim()) return null;
  const v = val.trim();
  if (v.includes('playlist?list=') || (v.includes('youtube.com') && v.includes('&list='))) return 'playlist';
  if (v.includes('youtube.com/') || v.includes('youtu.be/')) return 'video';
  return 'search';
}

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined leading-none ${className}`}>{name}</span>;
}

function Sidebar({ tab, setTab }) {
  const { jobs } = useQueue();
  const activeCount = Object.values(jobs).filter(j => !['done','error'].includes(j.status)).length;

  return (
    <nav className="hidden md:flex flex-col h-full fixed left-0 top-0 w-60 z-40 border-r border-white/[0.07] bg-surface-container-lowest/60 backdrop-blur-2xl">
      {/* Logo */}
      <div className="px-5 pt-7 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <svg width="22" height="16" viewBox="0 0 28 20">
            <rect width="28" height="20" rx="4" fill="#FF0000"/>
            <polygon points="11,5 21,10 11,15" fill="white"/>
          </svg>
          <span className="text-headline-md font-semibold text-primary tracking-tight">YTDown</span>
        </div>
        <div className="text-label-sm text-on-surface-variant ml-[30px]">Media Lab</div>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1 px-3 flex-1">
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} className={`nav-item ${tab === n.id ? 'active' : ''}`}>
            <Icon name={n.icon} className="text-[20px]" />
            {n.label}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.06]">
        {activeCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 mb-3">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-label-sm text-primary">{activeCount} downloading</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3">
          <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
          <span className="text-label-sm text-on-surface-variant">API Ready</span>
        </div>
      </div>
    </nav>
  );
}

function AppInner() {
  const [tab, setTab] = useState('video');
  const [videoInit,    setVideoInit]    = useState({ url: '', key: 0 });
  const [playlistInit, setPlaylistInit] = useState({ url: '', key: 0 });
  const [searchInit,   setSearchInit]   = useState({ query: '', key: 0 });
  const [cmdUrl, setCmdUrl] = useState('');

  const handleGo = () => {
    const val = cmdUrl.trim();
    if (!val) return;
    const type = detectType(val);
    if (type === 'playlist') {
      setPlaylistInit(p => ({ url: val, key: p.key + 1 }));
      setTab('playlist');
    } else if (type === 'video') {
      setVideoInit(p => ({ url: val, key: p.key + 1 }));
      setTab('video');
    } else {
      setSearchInit(p => ({ query: val, key: p.key + 1 }));
      setTab('search');
    }
    setCmdUrl('');
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar tab={tab} setTab={setTab} />

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 border-b border-white/[0.07] bg-black/70 backdrop-blur-xl">
        <span className="text-primary font-semibold text-lg tracking-tight">YTDown</span>
        <div className="flex gap-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`p-2 rounded-lg transition-colors ${tab === n.id ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <Icon name={n.icon} className="text-[20px]" />
            </button>
          ))}
        </div>
      </header>

      {/* Main canvas */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 flex flex-col items-center px-4 md:px-10 py-6 md:py-10">

        {/* Command Bar */}
        <div className="w-full max-w-3xl mb-8 relative">
          <div className="glass-panel glass-panel-border rounded-xl p-3 flex items-center gap-3 shadow-2xl">
            <Icon name="link" className="text-primary text-[26px] ml-1 flex-shrink-0" />
            <input
              className="flex-1 bg-transparent border-none text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 focus:outline-none h-11 text-[17px]"
              placeholder="Paste YouTube URL or search…"
              value={cmdUrl}
              onChange={e => setCmdUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGo()}
            />
            <button onClick={handleGo}
              className="btn-primary rounded-lg px-5 py-2.5 text-white text-label-sm uppercase tracking-wider flex items-center gap-2 flex-shrink-0">
              Go
              <Icon name="bolt" className="text-[16px]" />
            </button>
          </div>
          <div className="absolute -bottom-8 left-6 glass-panel rounded-full px-3 py-1 border border-tertiary/25 text-tertiary text-label-xs flex items-center gap-1 shadow-[0_0_15px_rgba(255,175,211,0.1)] pointer-events-none">
            <Icon name="auto_awesome" className="text-[12px]" />
            Video URL · Playlist URL · Search query — auto-detected
          </div>
        </div>

        {/* Tab content */}
        <div className="w-full max-w-6xl mt-4">
          {tab === 'video'    && <VideoTab    key={videoInit.key}    initialUrl={videoInit.url} />}
          {tab === 'playlist' && <PlaylistTab key={playlistInit.key} initialUrl={playlistInit.url} />}
          {tab === 'search'   && <SearchTab   key={searchInit.key}   initialQuery={searchInit.query} />}
          {tab === 'token'    && <TokenTab />}
        </div>
      </main>

      <DownloadPanel />
    </div>
  );
}

export default function App() {
  return <QueueProvider><AppInner /></QueueProvider>;
}
