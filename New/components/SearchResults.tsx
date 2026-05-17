'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ListVideo, Users, Film, Hash, User, Search } from 'lucide-react';
import { thumb } from '../lib/format';

type Tab = 'all' | 'videos' | 'shorts' | 'playlists' | 'channels';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'all',       label: 'All',      icon: <Hash className="w-3.5 h-3.5" />      },
  { id: 'videos',    label: 'Videos',   icon: <Film className="w-3.5 h-3.5" />      },
  { id: 'shorts',    label: 'Shorts',   icon: <Play className="w-3.5 h-3.5" />      },
  { id: 'playlists', label: 'Playlists',icon: <ListVideo className="w-3.5 h-3.5" /> },
  { id: 'channels',  label: 'Channels', icon: <Users className="w-3.5 h-3.5" />     },
];

export default function SearchResults({
  results,
  onSelect,
}: {
  results: any;
  onSelect: (url: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('all');

  const counts = {
    videos:    (results?.videos    || []).length,
    shorts:    (results?.shorts    || []).length,
    playlists: (results?.playlists || []).length,
    channels:  (results?.channels  || []).length,
  };
  const total = counts.videos + counts.shorts + counts.playlists + counts.channels;

  const show = (k: Tab) => tab === 'all' || tab === k;

  /* ── Empty ── */
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          <Search className="w-7 h-7 text-[var(--color-muted-foreground)]" />
        </div>
        <p className="text-lg font-semibold text-white">No results found</p>
        <p className="text-sm text-[var(--color-muted-foreground)]">Try a different search term or paste a URL directly.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-2xl font-display font-bold text-white">
            Search Results
          </p>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
            {total} result{total !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const c = t.id === 'all' ? total : (counts as any)[t.id];
            if (t.id !== 'all' && c === 0) return null;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`tab-btn shrink-0 ${tab === t.id ? 'active' : ''}`}
              >
                {t.icon}
                {t.label}
                <span className="text-[10px] font-mono bg-[var(--color-surface3)] px-1.5 py-0.5 rounded-full">
                  {c}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content sections */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-10"
        >
          {show('videos')    && counts.videos    > 0 && (
            <ResultSection title="Videos"    icon={<Film className="w-4 h-4 text-[var(--color-primary)]" />}
              items={results.videos} kind="video" onSelect={onSelect} />
          )}
          {show('shorts')    && counts.shorts    > 0 && (
            <ResultSection title="Shorts"    icon={<Play className="w-4 h-4 text-[var(--color-accent)]" />}
              items={results.shorts} kind="short" onSelect={onSelect} />
          )}
          {show('playlists') && counts.playlists > 0 && (
            <ResultSection title="Playlists" icon={<ListVideo className="w-4 h-4 text-[var(--color-primary)]" />}
              items={results.playlists} kind="playlist" onSelect={onSelect} />
          )}
          {show('channels')  && counts.channels  > 0 && (
            <ResultSection title="Channels"  icon={<Users className="w-4 h-4 text-[var(--color-primary)]" />}
              items={results.channels} kind="channel" onSelect={onSelect} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── Section ── */
function ResultSection({
  title, icon, items, kind, onSelect,
}: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  kind: string;
  onSelect: (url: string) => void;
}) {
  const isChannel = kind === 'channel';

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-display font-bold text-lg text-white">{title}</h3>
        <span className="text-xs font-mono text-[var(--color-muted-foreground)] bg-[var(--color-surface2)] border border-[var(--color-border)] px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      <div className={`grid gap-4 ${
        isChannel
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
          : kind === 'short'
            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      }`}>
        {items.map((item, i) => (
          <ResultCard
            key={item.video_id || item.url || i}
            item={item}
            kind={kind}
            idx={i}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

/* ── Card ── */
function ResultCard({
  item, kind, idx, onSelect,
}: {
  item: any; kind: string; idx: number; onSelect: (url: string) => void;
}) {
  const t        = thumb(item.video_id, 'mq');
  const isChannel = kind === 'channel';

  const aspectClass =
    kind === 'short'   ? 'aspect-[9/16] max-h-52' :
    isChannel          ? 'aspect-square' :
                         'aspect-video';

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.3 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      onClick={() => onSelect(item.url)}
      className="card overflow-hidden cursor-pointer group text-left flex flex-col hover:border-[var(--color-border2)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className={`relative w-full overflow-hidden bg-[var(--color-surface2)] ${aspectClass}`}>
        {t ? (
          <img
            src={t}
            alt={item.title || 'Result'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isChannel
              ? <Users className="w-10 h-10 text-white/20" />
              : <ListVideo className="w-10 h-10 text-white/20" />}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <motion.div
            className="w-11 h-11 rounded-full bg-[var(--color-primary)] flex items-center justify-center shadow-lg shadow-red-500/30"
            whileHover={{ scale: 1.1 }}
          >
            <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
          </motion.div>
        </div>

        {/* Kind badge */}
        <div className="absolute top-2 left-2 opacity-90 group-hover:opacity-100 transition-opacity">
          <span className={`badge ${kind === 'short' ? 'badge-green' : kind === 'channel' ? 'badge-blue' : kind === 'playlist' ? 'badge-purple' : 'badge-gray'}`}>
            {kind.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-1">
        <p className="text-sm font-semibold line-clamp-2 leading-snug text-white group-hover:text-white transition-colors">
          {item.title || item.author || 'Untitled'}
        </p>
        {item.author && item.title && (
          <p className="text-xs text-[var(--color-muted-foreground)] flex items-center gap-1 mt-auto pt-1">
            <User className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{item.author}</span>
          </p>
        )}
      </div>
    </motion.button>
  );
}
