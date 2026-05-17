'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchApi } from '../lib/api';
import { fmtViews, thumb } from '../lib/format';
import { toast } from 'sonner';
import {
  Loader2, ListVideo, User, Eye, Calendar, Play,
  ChevronLeft, ChevronRight, RotateCw, Hash,
} from 'lucide-react';

export default function PlaylistView({
  url,
  onOpenVideo,
  onAnotherUrl,
}: {
  url: string;
  onOpenVideo: (videoUrl: string) => void;
  onAnotherUrl: () => void;
}) {
  const [info, setInfo]         = useState<any>(null);
  const [videos, setVideos]     = useState<any>(null);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const PAGE_SIZE = 50;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setInfo(null); setVideos(null); setPage(1);
      try {
        const [infoRes, videosRes] = await Promise.all([
          fetchApi(`/playlist/info?url=${encodeURIComponent(url)}`).catch(() => null),
          fetchApi(`/playlist/videos?url=${encodeURIComponent(url)}&page=1&page_size=${PAGE_SIZE}`),
        ]);
        if (mounted) { setInfo(infoRes); setVideos(videosRes); }
      } catch (err: any) {
        if (mounted) toast.error('Failed to load playlist', { description: err.message });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [url]);

  const goPage = async (p: number) => {
    setPageLoading(true);
    try {
      const res = await fetchApi(`/playlist/videos?url=${encodeURIComponent(url)}&page=${p}&page_size=${PAGE_SIZE}`);
      setVideos(res); setPage(p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      toast.error('Failed to load page', { description: err.message });
    } finally {
      setPageLoading(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Info skeleton */}
        <div className="card overflow-hidden">
          <div className="shimmer w-full aspect-video" />
          <div className="p-5 flex flex-col gap-3">
            <div className="shimmer h-5 w-3/4 rounded" />
            <div className="shimmer h-4 w-1/2 rounded" />
            <div className="shimmer h-4 w-2/3 rounded" />
            <div className="shimmer h-4 w-1/3 rounded" />
          </div>
        </div>
        {/* List skeleton */}
        <div className="card overflow-hidden">
          <div className="section-banner">Videos</div>
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
                <div className="shimmer w-5 h-4 rounded shrink-0" />
                <div className="shimmer w-28 h-16 rounded-lg shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="shimmer h-4 w-full rounded" />
                  <div className="shimmer h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!videos) return null;

  const totalPages = Math.ceil((videos.total || 0) / PAGE_SIZE);
  const list: any[] = videos.videos || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-6"
    >
      {/* Desktop: side-by-side. Mobile: stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

        {/* ── Left: Playlist Info (sticky on desktop) ── */}
        <div className="lg:sticky lg:top-20 flex flex-col gap-4">
          <div className="card overflow-hidden">
            {/* Hero thumbnail */}
            <div className="relative w-full aspect-video bg-black overflow-hidden">
              {info?.thumbnail_url ? (
                <img
                  src={info.thumbnail_url}
                  alt={info.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--color-surface2)]">
                  <ListVideo className="w-16 h-16 text-white/20" />
                </div>
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              {/* Video count badge */}
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-lg text-xs font-mono font-bold">
                {videos.total} videos
              </div>
              {/* Play all */}
              <div className="absolute bottom-4 left-4 right-4">
                <motion.button
                  onClick={() => list[0] && onOpenVideo(list[0].url)}
                  className="w-full flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  Play First Video
                </motion.button>
              </div>
            </div>

            {/* Playlist meta */}
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-start gap-2">
                <span className="badge badge-purple mt-0.5">PLAYLIST</span>
              </div>
              <h1 className="text-xl font-bold leading-snug text-white">
                {info?.title || 'Playlist'}
              </h1>

              {/* Stats */}
              <div className="flex flex-wrap gap-4 text-sm text-[var(--color-muted-foreground)]">
                {info?.owner && (
                  <span className="flex items-center gap-1.5 font-medium text-white">
                    <span className="w-5 h-5 rounded-full bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.25)] flex items-center justify-center shrink-0">
                      <User className="w-2.5 h-2.5 text-[var(--color-primary)]" />
                    </span>
                    {info.owner}
                  </span>
                )}
                {info?.views != null && (
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />{fmtViews(info.views)} views
                  </span>
                )}
                {info?.last_updated && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />{info.last_updated}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />{videos.total} videos
                </span>
              </div>

              {/* Description */}
              {info?.description && (
                <p className="text-sm text-[var(--color-muted-foreground)] line-clamp-4 leading-relaxed">
                  {info.description}
                </p>
              )}
            </div>
          </div>

          {/* Another URL button */}
          <motion.button
            onClick={onAnotherUrl}
            className="btn-card"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <RotateCw className="w-4 h-4" /> Download Another URL
          </motion.button>
        </div>

        {/* ── Right: Video list ── */}
        <div className="card overflow-hidden">
          {/* Header with pagination */}
          <div className="section-banner justify-between">
            <span className="flex items-center gap-2">
              <ListVideo className="w-4 h-4 text-[var(--color-primary)]" />
              Videos
              <span className="text-xs font-mono text-[var(--color-muted-foreground)]">
                ({(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, videos.total)} of {videos.total})
              </span>
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => goPage(page - 1)}
                  disabled={page <= 1 || pageLoading}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface3)] border border-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-[var(--color-muted-foreground)] px-1">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => goPage(page + 1)}
                  disabled={page >= totalPages || pageLoading}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface3)] border border-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Loading overlay for page change */}
          {pageLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {list.map((v: any, i: number) => {
                  const idx = (page - 1) * PAGE_SIZE + i + 1;
                  return (
                    <motion.button
                      key={v.video_id || i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.012, 0.25), duration: 0.25 }}
                      onClick={() => onOpenVideo(v.url)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-[var(--color-surface2)] transition text-left group border-b border-[var(--color-border)] last:border-b-0"
                    >
                      {/* Index */}
                      <span className="font-mono text-xs text-[var(--color-muted-foreground)] w-7 text-right shrink-0 group-hover:text-[var(--color-primary)] transition-colors">
                        {idx}
                      </span>

                      {/* Thumbnail */}
                      <div className="relative w-28 aspect-video shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface2)]">
                        <img
                          src={thumb(v.video_id, 'mq')}
                          alt={v.title || v.video_id}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-5 h-5 text-white" fill="currentColor" />
                        </div>
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white line-clamp-2 leading-snug group-hover:text-[var(--color-primary)] transition-colors">
                          {v.title || v.video_id}
                        </p>
                        <p className="text-[11px] font-mono text-[var(--color-muted-foreground)] mt-1">
                          {v.video_id}
                        </p>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="w-4 h-4 text-[var(--color-muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Bottom pagination for long lists */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface2)]">
              <button
                onClick={() => goPage(page - 1)}
                disabled={page <= 1 || pageLoading}
                className="btn btn-outline text-sm disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-xs font-mono text-[var(--color-muted-foreground)]">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => goPage(page + 1)}
                disabled={page >= totalPages || pageLoading}
                className="btn btn-outline text-sm disabled:opacity-30"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
