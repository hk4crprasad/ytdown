import { useState, useEffect } from 'react';
import { api } from './api';
import { QueueProvider } from './context/QueueContext';
import VideoTab    from './tabs/VideoTab';
import PlaylistTab from './tabs/PlaylistTab';
import SearchTab   from './tabs/SearchTab';
import TokenTab    from './tabs/TokenTab';
import './index.css';

const TABS = ['Video', 'Playlist', 'Search', 'Token'];

export default function App() {
  const [tab, setTab]           = useState('Video');
  const [online, setOnline]     = useState(false);
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    api.health()
      .then(d => { setOnline(true); setTokenReady(d.token_ready); })
      .catch(() => setOnline(false));
  }, []);

  return (
    <QueueProvider>
      <div className="app">
        <nav className="navbar">
          <div className="navbar-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>YT<em>Down</em></span>
          </div>
          <div className="navbar-status">
            <div className={`dot ${online ? 'online' : ''}`} />
            {online ? `API online${tokenReady ? ' · auth ready' : ' · no token'}` : 'API offline'}
          </div>
        </nav>

        <main className="main">
          <div className="tabs">
            {TABS.map(t => (
              <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          {tab === 'Video'    && <VideoTab />}
          {tab === 'Playlist' && <PlaylistTab />}
          {tab === 'Search'   && <SearchTab />}
          {tab === 'Token'    && <TokenTab onUpload={() => setTokenReady(true)} />}
        </main>
      </div>
    </QueueProvider>
  );
}
