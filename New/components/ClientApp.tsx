'use client';

import { useState, useRef } from 'react';
import {
  Download, ClipboardPaste, X, Settings, Globe, Sun, Moon,
  Zap, Layers, Music, Captions as CaptionsIcon,
  ListVideo, Search, Youtube, Home, Film, Menu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchApi } from '../lib/api';
import { detectUrlType } from '../lib/format';
import { useTurnstile } from '../lib/turnstile';
import { toast } from 'sonner';
import VideoDetails from './VideoDetails';
import ActiveJobs, { JobsProvider } from './ActiveJobs';
import SearchResults from './SearchResults';
import PlaylistView from './PlaylistView';
import CaptionsPanel from './CaptionsPanel';
import ConfigModal from './ConfigModal';

type View =
  | { kind: 'home' }
  | { kind: 'search'; query: string; results: any }
  | { kind: 'video'; url: string; back?: View }
  | { kind: 'playlist'; url: string; back?: View }
  | { kind: 'captions'; url: string; back?: View };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

const FEATURES = [
  { icon: <Zap className="w-5 h-5" />,         title: 'All Resolutions',     desc: 'From 144p up to 4K, HDR and 60fps — every stream YouTube provides, including adaptive video-only and audio-only tracks.' },
  { icon: <Layers className="w-5 h-5" />,       title: 'FFmpeg Merge',        desc: 'High-quality adaptive streams are merged server-side using FFmpeg. Watch real-time progress via Server-Sent Events.' },
  { icon: <Music className="w-5 h-5" />,        title: 'Audio Extraction',    desc: 'Extract M4A, WebM or MP3 audio at any bitrate. Perfect for music, podcasts and offline listening.' },
  { icon: <CaptionsIcon className="w-5 h-5" />, title: 'Captions & Subtitles',desc: 'Download subtitles in SRT, TXT or raw XML. Supports auto-generated captions and every available language.' },
  { icon: <ListVideo className="w-5 h-5" />,    title: 'Full Playlists',      desc: 'Browse and download entire playlists. Paginated video list with thumbnails, titles and direct video access.' },
  { icon: <Search className="w-5 h-5" />,       title: 'YouTube Search',      desc: 'Search videos, shorts, playlists and channels. Filter by type, date, duration and sort by relevance or views.' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Paste a URL or Search', desc: 'Enter any YouTube video, playlist URL or just type a search query.' },
  { step: '02', title: 'Pick Your Format',       desc: 'Choose from every available quality — 4K, HD, audio-only and more.' },
  { step: '03', title: 'Download Instantly',    desc: 'Progressive streams download directly. Adaptive streams are merged on the server and ready in seconds.' },
];

/* Mobile navigation items */
const MOBILE_NAV = [
  { id: 'home',     label: 'Home',     icon: <Home className="w-5 h-5" /> },
  { id: 'video',    label: 'Video',    icon: <Film className="w-5 h-5" /> },
  { id: 'playlist', label: 'Playlist', icon: <ListVideo className="w-5 h-5" /> },
  { id: 'search',   label: 'Search',   icon: <Search className="w-5 h-5" /> },
  { id: 'captions', label: 'Captions', icon: <CaptionsIcon className="w-5 h-5" /> },
];

export default function ClientApp() {
  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [view, setView]         = useState<View>({ kind: 'home' });
  const [configOpen, setConfigOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark]     = useState(true);
  const inputRef                = useRef<HTMLInputElement>(null);
  const { containerRef: turnstileRef, getToken, reset: resetTurnstile } = useTurnstile();

  const goHome = () => { setQuery(''); setView({ kind: 'home' }); setMobileMenuOpen(false); };

  const openUrl = (url: string, back?: View) => {
    const kind = detectUrlType(url);
    setQuery(url);
    setView(kind === 'playlist' ? { kind: 'playlist', url, back } : { kind: 'video', url, back });
  };

  const runSearch = async (q: string) => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetchApi(`/search?q=${encodeURIComponent(q)}`, {}, token);
      setView({ kind: 'search', query: q, results: res });
    } catch (err: any) {
      resetTurnstile();
      toast.error('Search failed', { description: err.message });
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    const kind = detectUrlType(q);
    if (kind === 'video')         setView({ kind: 'video', url: q });
    else if (kind === 'playlist') setView({ kind: 'playlist', url: q });
    else                          await runSearch(q);
    // Token is single-use — reset after each submission so the next
    // challenge starts immediately and a fresh token is ready.
    resetTurnstile();
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { setQuery(text); toast.success('Pasted from clipboard'); }
    } catch { toast.error('Clipboard access denied'); }
  };

  /* Focus the input and show a hint */
  const focusWithHint = (placeholder: string) => {
    setMobileMenuOpen(false);
    setView({ kind: 'home' });
    setQuery('');
    setTimeout(() => {
      inputRef.current?.focus();
      toast.info(placeholder, { duration: 3000 });
    }, 100);
  };

  const handleMobileNav = (id: string) => {
    setMobileMenuOpen(false);
    if (id === 'home') { goHome(); return; }
    if (id === 'video')    { focusWithHint('Paste a YouTube video URL, e.g. youtube.com/watch?v=…'); return; }
    if (id === 'playlist') { focusWithHint('Paste a YouTube playlist URL, e.g. youtube.com/playlist?list=…'); return; }
    if (id === 'search')   { focusWithHint('Type any search query, e.g. "lofi music" or "python tutorial"'); return; }
    if (id === 'captions') { focusWithHint('First paste a video URL, then click "Captions" on the video page'); return; }
  };

  const isHome = view.kind === 'home';

  /* Current active mobile nav tab */
  const activeMobileTab =
    view.kind === 'home'     ? 'home'    :
    view.kind === 'video'    ? 'video'   :
    view.kind === 'playlist' ? 'playlist':
    view.kind === 'search'   ? 'search'  :
    view.kind === 'captions' ? 'captions': 'home';

  return (
    <JobsProvider>
      {/* Hidden Turnstile widget container — invisible mode, no UI shown */}
      <div ref={turnstileRef} style={{ display: 'none' }} aria-hidden="true" />
      <div className="flex flex-col min-h-screen">

        {/* ── Top Navbar ── */}
        <nav className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/90 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

            {/* Logo */}
            <button onClick={goHome} className="flex items-center gap-2.5 shrink-0">
              <motion.div whileHover={{ scale: 1.05 }} className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-md">
                <Download className="w-4 h-4 text-black" strokeWidth={2.5} />
              </motion.div>
              <span className="font-display font-bold text-lg tracking-tight">
                YTApi<span className="text-[var(--color-primary)]">.</span>
              </span>
            </button>

            {/* Desktop center nav */}
            <div className="hidden md:flex items-center gap-1">
              {[
                { label: 'Videos',    icon: <Film className="w-3.5 h-3.5" />,         hint: 'Paste a YouTube video URL' },
                { label: 'Playlists', icon: <ListVideo className="w-3.5 h-3.5" />,    hint: 'Paste a playlist URL' },
                { label: 'Search',    icon: <Search className="w-3.5 h-3.5" />,       hint: 'Search for anything on YouTube' },
                { label: 'Captions',  icon: <CaptionsIcon className="w-3.5 h-3.5" />, hint: 'Open a video first, then click Captions' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => focusWithHint(item.hint)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--color-muted-foreground)] hover:text-white hover:bg-[var(--color-surface2)] transition-all"
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setIsDark(!isDark)} className="icon-btn hidden sm:flex" title="Theme">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button className="icon-btn hidden sm:flex" title="Language">
                <Globe className="w-4 h-4" />
              </button>
              {/* Desktop config */}
              <button onClick={() => setConfigOpen(true)} className="icon-btn primary hidden md:flex" title="Config">
                <Settings className="w-4 h-4" />
              </button>
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="icon-btn primary md:hidden"
                title="Menu"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>
        </nav>

        {/* ── Mobile slide-down menu ── */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 z-50 md:hidden"
              />
              {/* Drawer */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 bottom-0 w-72 z-50 md:hidden flex flex-col"
                style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)' }}
              >
                {/* Drawer header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
                  <span className="font-display font-bold text-lg">
                    YTApi<span className="text-[var(--color-primary)]">.</span>
                  </span>
                  <button onClick={() => setMobileMenuOpen(false)} className="icon-btn">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Navigation items */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-muted-foreground)] px-2 mb-1">
                    Navigate
                  </p>
                  {MOBILE_NAV.map((item) => (
                    <motion.button
                      key={item.id}
                      onClick={() => handleMobileNav(item.id)}
                      whileTap={{ scale: 0.97 }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        activeMobileTab === item.id
                          ? 'bg-[rgba(239,68,68,0.12)] text-[var(--color-primary)] border border-[rgba(239,68,68,0.25)]'
                          : 'text-[var(--color-muted-foreground)] hover:text-white hover:bg-[var(--color-surface2)]'
                      }`}
                    >
                      <span className={activeMobileTab === item.id ? 'text-[var(--color-primary)]' : ''}>
                        {item.icon}
                      </span>
                      {item.label}
                      {activeMobileTab === item.id && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                      )}
                    </motion.button>
                  ))}

                  <div className="my-2 border-t border-[var(--color-border)]" />

                  <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-muted-foreground)] px-2 mb-1">
                    Settings
                  </p>
                  <button
                    onClick={() => { setMobileMenuOpen(false); setConfigOpen(true); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--color-muted-foreground)] hover:text-white hover:bg-[var(--color-surface2)] transition-all"
                  >
                    <Settings className="w-5 h-5" /> Configuration
                  </button>
                  <button
                    onClick={() => setIsDark(!isDark)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--color-muted-foreground)] hover:text-white hover:bg-[var(--color-surface2)] transition-all"
                  >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                  </button>
                </div>

                {/* How-to hint */}
                <div className="p-4 border-t border-[var(--color-border)]">
                  <div className="bg-[var(--color-surface2)] rounded-xl p-4 text-xs text-[var(--color-muted-foreground)] leading-relaxed">
                    <p className="font-bold text-white mb-1">Quick start</p>
                    Paste a YouTube URL or type a search query in the input field on the home screen.
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Mobile bottom tab bar ── */}
        <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl">
          <div className="flex items-stretch h-16">
            {MOBILE_NAV.map((item) => {
              const isActive = activeMobileTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleMobileNav(item.id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-all ${
                    isActive
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-muted-foreground)] hover:text-white'
                  }`}
                >
                  <motion.span
                    animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    {item.icon}
                  </motion.span>
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="mobile-tab-dot"
                      className="absolute top-0 w-8 h-0.5 bg-[var(--color-primary)] rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main ── */}
        <div className="flex-1 pb-16 md:pb-0">

          {/* Hero — home only */}
          <AnimatePresence>
            {isHome && (
              <motion.section
                key="hero"
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
                variants={stagger}
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12 text-center"
              >
                <motion.div variants={fadeUp} className="mb-6">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] px-4 py-2 rounded-full">
                    <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-pulse" />
                    Free · No Signup · No Limits
                  </span>
                </motion.div>

                <motion.h1
                  variants={fadeUp}
                  className="font-display font-bold leading-none tracking-tighter mb-6 text-5xl sm:text-7xl lg:text-8xl xl:text-9xl"
                >
                  <span className="gradient-text">YouTube</span>
                  <br />
                  <span className="text-white">Media Extractor</span>
                </motion.h1>

                <motion.p
                  variants={fadeUp}
                  className="text-[var(--color-muted-foreground)] text-base sm:text-xl lg:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed"
                >
                  Download any video, extract audio, grab subtitles or explore entire playlists — instantly, in every quality.
                </motion.p>

                {/* Search */}
                <motion.div variants={fadeUp} className="max-w-2xl mx-auto mb-6">
                  <form onSubmit={handleSubmit}>
                    <div className="input-wrap shadow-[0_0_40px_rgba(239,68,68,0.08)]">
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Paste YouTube URL or search anything…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query ? (
                        <button type="button" onClick={() => setQuery('')} className="btn-clear">
                          <X className="w-3.5 h-3.5" /> Clear
                        </button>
                      ) : (
                        <button type="button" onClick={pasteFromClipboard} className="btn-paste">
                          <ClipboardPaste className="w-3.5 h-3.5" /> Paste
                        </button>
                      )}
                    </div>
                  </form>
                </motion.div>

                <motion.div variants={fadeUp} className="flex justify-center">
                  <motion.button
                    onClick={() => handleSubmit()}
                    disabled={!query.trim() || loading}
                    className="btn-cta"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Processing…</>
                      : <><Download className="w-4 h-4" /> Download</>
                    }
                  </motion.button>
                </motion.div>

                {/* Stats */}
                <motion.div
                  variants={fadeUp}
                  className="flex flex-wrap justify-center gap-8 mt-14"
                >
                  {[
                    { value: '4K',     label: 'Max Quality'     },
                    { value: '8×',     label: 'Parallel Threads'},
                    { value: 'SSE',    label: 'Live Progress'   },
                    { value: 'FFmpeg', label: 'Server Merge'    },
                  ].map(({ value, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <span className="font-display font-bold text-2xl text-white">{value}</span>
                      <span className="text-sm text-[var(--color-muted-foreground)]">{label}</span>
                    </div>
                  ))}
                </motion.div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Inline search bar when not on home */}
          {!isHome && (
            <div className="border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-sm py-3">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <form onSubmit={handleSubmit} className="max-w-2xl">
                  <div className="input-wrap">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Paste YouTube URL or search…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query ? (
                      <button type="button" onClick={() => setQuery('')} className="btn-clear">
                        <X className="w-3.5 h-3.5" /> Clear
                      </button>
                    ) : (
                      <button type="button" onClick={pasteFromClipboard} className="btn-paste">
                        <ClipboardPaste className="w-3.5 h-3.5" /> Paste
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Dynamic content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <AnimatePresence mode="wait">
              {view.kind === 'search' && (
                <motion.div key="search" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
                  <SearchResults results={view.results} onSelect={(url) => openUrl(url, view)} />
                </motion.div>
              )}
              {view.kind === 'video' && (
                <motion.div key={`v-${view.url}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
                  <VideoDetails url={view.url} onOpenCaptions={() => setView({ kind: 'captions', url: view.url, back: view })} onAnotherUrl={goHome} />
                </motion.div>
              )}
              {view.kind === 'playlist' && (
                <motion.div key={`pl-${view.url}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
                  <PlaylistView url={view.url} onOpenVideo={(u) => openUrl(u, view)} onAnotherUrl={goHome} />
                </motion.div>
              )}
              {view.kind === 'captions' && (
                <motion.div key={`cap-${view.url}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
                  <CaptionsPanel url={view.url} onBack={view.back ? () => setView(view.back!) : undefined} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Feature section — home only */}
          {isHome && (
            <>
              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger} className="text-center mb-10">
                  <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] mb-3">What you can do</motion.p>
                  <motion.h2 variants={fadeUp} className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white mb-4">Everything in one place</motion.h2>
                  <motion.p variants={fadeUp} className="text-[var(--color-muted-foreground)] text-lg max-w-xl mx-auto">No third-party services, no limits. Direct extraction from YouTube via our FastAPI backend.</motion.p>
                </motion.div>
                <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {FEATURES.map((f) => (
                    <motion.div key={f.title} variants={fadeUp} whileHover={{ y: -4 }} className="feature-card">
                      <div className="feature-icon">{f.icon}</div>
                      <div>
                        <h3 className="font-display font-bold text-lg text-white mb-2">{f.title}</h3>
                        <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">{f.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </section>

              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-[var(--color-border)]">
                <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger} className="text-center mb-10">
                  <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] mb-3">Simple process</motion.p>
                  <motion.h2 variants={fadeUp} className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-white">How it works</motion.h2>
                </motion.div>
                <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                  {HOW_IT_WORKS.map((step) => (
                    <motion.div key={step.step} variants={fadeUp} className="flex flex-col items-center text-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center font-display font-bold text-2xl text-[var(--color-primary)]">
                        {step.step}
                      </div>
                      <h3 className="font-bold text-lg text-white">{step.title}</h3>
                      <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">{step.desc}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </section>

              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-[var(--color-border)]">
                <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger}
                  className="relative rounded-2xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] p-8 sm:p-12 text-center"
                >
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(239,68,68,0.1) 0%, transparent 70%)' }} />
                  <motion.h2 variants={fadeUp} className="font-display font-bold text-3xl sm:text-4xl text-white mb-4 relative z-10">Ready to download?</motion.h2>
                  <motion.p variants={fadeUp} className="text-[var(--color-muted-foreground)] mb-8 text-lg relative z-10">Paste your first URL above and get started instantly.</motion.p>
                  <motion.button
                    variants={fadeUp}
                    onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => inputRef.current?.focus(), 400); }}
                    className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-base rounded-xl relative z-10"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Download className="w-5 h-5" /> Get Started
                  </motion.button>
                </motion.div>
              </section>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/60 pb-16 md:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                    <Download className="w-4 h-4 text-black" strokeWidth={2.5} />
                  </div>
                  <span className="font-display font-bold text-base">YTApi<span className="text-[var(--color-primary)]">.</span></span>
                </div>
                <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed max-w-xs">
                  A production-grade YouTube media extraction platform built on FastAPI, pytubefix and FFmpeg.
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4">Features</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {['Video Download', 'Audio Extraction', 'Playlist Browser', 'Caption Download', 'YouTube Search', 'SSE Progress'].map((item) => (
                    <li key={item} className="text-[var(--color-muted-foreground)]">{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4">Tech Stack</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {['FastAPI + Uvicorn', 'pytubefix', 'FFmpeg', 'Next.js 15', 'Tailwind CSS', 'Framer Motion'].map((item) => (
                    <li key={item} className="text-[var(--color-muted-foreground)]">{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4">Formats</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {['4K / 2K / 1080p HD', '720p / 480p / 360p', '144p (data-saver)', 'M4A 128kbps Audio', 'SRT / TXT / XML Captions', 'Adaptive + Merged'].map((item) => (
                    <li key={item} className="text-[var(--color-muted-foreground)]">{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-[var(--color-border)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-muted-foreground)]">© {new Date().getFullYear()} YTApi. Not affiliated with YouTube or Google.</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">This service does not host or store any videos on its servers.</p>
            </div>
          </div>
        </footer>

        <ActiveJobs />

        <AnimatePresence>
          {configOpen && <ConfigModal onClose={() => setConfigOpen(false)} />}
        </AnimatePresence>
      </div>
    </JobsProvider>
  );
}
