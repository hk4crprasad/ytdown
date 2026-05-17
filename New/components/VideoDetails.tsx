'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchApi, API_URL } from '../lib/api';
import { fmtDuration, fmtMB, fmtViews, extractVideoId } from '../lib/format';
import { toast } from 'sonner';
import {
  Download, Loader2, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, RefreshCw,
  Captions as CaptionsIcon, User, Clock, RotateCw,
  Eye, ThumbsUp, Calendar, ExternalLink, Zap,
} from 'lucide-react';

interface FormatOption {
  id: string;
  kind: 'merge' | 'progressive' | 'audio';
  groupLabel: string;
  label: string;
  sub?: string;
  itag: number;
  filesize_mb: number | null;
}

type DlState =
  | { s: 'idle' }
  | { s: 'starting' }
  | { s: 'queued' }
  | { s: 'progress'; pct: number; phase: string; done_mb?: number; total_mb?: number; speed?: number }
  | { s: 'done'; url: string }
  | { s: 'error'; msg: string };

function buildFormats(streams: any, mergeOpts: any): FormatOption[] {
  const out: FormatOption[] = [];
  if (mergeOpts?.video_streams?.length) {
    for (const s of mergeOpts.video_streams) {
      const res = parseInt(s.resolution || '0');
      const ext = (s.subtype || 'mp4').toUpperCase();
      const dim = s.width && s.height ? `${s.width}x${s.height}` : (s.resolution || '?');
      const qLabel = s.is_hdr ? 'HDR' : res >= 2160 ? '4K' : res >= 1440 ? '2K' : res >= 1080 ? 'HD' : res >= 720 ? 'HD' : 'SD';
      out.push({
        id: `merge-${s.itag}`, kind: 'merge', groupLabel: 'High Quality (Merge)',
        label: `${ext} - (${dim} ${qLabel})${s.fps && s.fps > 30 ? ` ${s.fps}fps` : ''}`,
        sub: `${s.video_codec || 'AVC1'} + AAC · server merge`,
        itag: s.itag, filesize_mb: s.filesize_mb,
      });
    }
  }
  if (streams?.progressive?.length) {
    const sorted = [...streams.progressive].sort((a, b) => parseInt(b.resolution || '0') - parseInt(a.resolution || '0'));
    for (const s of sorted) {
      const res = parseInt(s.resolution || '0');
      const ext = (s.subtype || 'mp4').toUpperCase();
      const dim = s.width && s.height ? `${s.width}x${s.height}` : (s.resolution || '?');
      out.push({
        id: `prog-${s.itag}`, kind: 'progressive', groupLabel: 'Direct Download',
        label: `${ext} - (${dim} ${res >= 720 ? 'HD' : 'SD'})`,
        sub: `${s.video_codec || ''} + ${s.audio_codec || 'AAC'} · video+audio`,
        itag: s.itag, filesize_mb: s.filesize_mb,
      });
    }
  }
  if (streams?.audio_only?.length) {
    const sorted = [...streams.audio_only].sort((a, b) => parseInt(b.abr || '0') - parseInt(a.abr || '0'));
    for (const s of sorted) {
      const ext = (s.subtype || 'm4a').toUpperCase();
      const codec = (s.audio_codec || '').toLowerCase();
      const fmt = codec.includes('mp3') || ext === 'MP3' ? 'MP3' : ext === 'MP4' ? 'M4A' : ext;
      out.push({
        id: `audio-${s.itag}`, kind: 'audio', groupLabel: 'Audio Only',
        label: `${fmt} - (${s.abr || '?'})`,
        sub: s.audio_codec || fmt,
        itag: s.itag, filesize_mb: s.filesize_mb,
      });
    }
  }
  return out;
}

function groupFormats(formats: FormatOption[]) {
  const map = new Map<string, FormatOption[]>();
  for (const f of formats) {
    if (!map.has(f.groupLabel)) map.set(f.groupLabel, []);
    map.get(f.groupLabel)!.push(f);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export default function VideoDetails({
  url, onOpenCaptions, onAnotherUrl,
}: {
  url: string; onOpenCaptions: () => void; onAnotherUrl: () => void;
}) {
  const [info, setInfo]           = useState<any>(null);
  const [streams, setStreams]     = useState<any>(null);
  const [mergeOpts, setMergeOpts] = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [formats, setFormats]     = useState<FormatOption[]>([]);
  const [selected, setSelected]   = useState<FormatOption | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dlState, setDlState]     = useState<DlState>({ s: 'idle' });
  const [descExpanded, setDescExpanded] = useState(false);
  const videoId = extractVideoId(url);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setInfo(null); setStreams(null); setMergeOpts(null);
      setFormats([]); setSelected(null); setDlState({ s: 'idle' }); setPickerOpen(false);
      try {
        const [infoRes, streamsRes, optsRes] = await Promise.all([
          fetchApi(`/video/info?url=${encodeURIComponent(url)}`),
          fetchApi(`/video/streams?url=${encodeURIComponent(url)}`).catch(() => null),
          fetchApi(`/merge/options?url=${encodeURIComponent(url)}`).catch(() => null),
        ]);
        if (!mounted) return;
        setInfo(infoRes); setStreams(streamsRes); setMergeOpts(optsRes);
        const fmts = buildFormats(streamsRes, optsRes);
        setFormats(fmts);
        if (fmts.length) setSelected(fmts[0]);
      } catch (err: any) {
        if (mounted) toast.error('Failed to load video', { description: err.message });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [url]);

  const handleDownload = useCallback(async () => {
    if (!selected || ['starting', 'progress', 'queued'].includes(dlState.s)) return;
    if (selected.kind !== 'merge') {
      const endpoint = selected.kind === 'audio' ? 'audio' : 'video';
      window.open(`${API_URL}/${endpoint}/download?url=${encodeURIComponent(url)}&itag=${selected.itag}`, '_blank');
      return;
    }
    setDlState({ s: 'starting' });
    try {
      const res = await fetchApi(`/merge/start?url=${encodeURIComponent(url)}&itag=${selected.itag}`, { method: 'POST' });
      setDlState({ s: 'queued' });
      const es = new EventSource(`${API_URL}/merge/progress/${res.job_id}`);
      es.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d._eof || d.status === 'done') {
          es.close(); setDlState({ s: 'done', url: `${API_URL}${d.download_url}` });
        } else if (d.status === 'error') {
          es.close(); setDlState({ s: 'error', msg: d.error || 'Failed' });
        } else if (['downloading', 'merging'].includes(d.status)) {
          const totalMb = ((d.video_bytes_total || 0) + (d.audio_bytes_total || 0)) / 1024 / 1024;
          const doneMb  = ((d.video_bytes_done  || 0) + (d.audio_bytes_done  || 0)) / 1024 / 1024;
          setDlState({ s: 'progress', pct: d.overall_pct || 0, phase: d.phase || d.status, done_mb: totalMb > 0 ? doneMb : undefined, total_mb: totalMb > 0 ? totalMb : undefined, speed: d.video_speed_mbps });
        }
      };
      es.onerror = () => { es.close(); setDlState({ s: 'error', msg: 'Connection lost' }); };
    } catch (err: any) { setDlState({ s: 'error', msg: err.message }); }
  }, [selected, dlState.s, url]);

  /* Loading */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="card overflow-hidden">
          <div className="section-banner">Information</div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="shimmer w-full aspect-video rounded-xl" />
            <div className="flex flex-col gap-3">
              <div className="shimmer h-4 w-1/3 rounded" />
              <div className="shimmer h-6 w-full rounded" />
              <div className="shimmer h-6 w-2/3 rounded" />
              <div className="shimmer h-4 w-full rounded mt-2" />
              <div className="shimmer h-4 w-4/5 rounded" />
            </div>
          </div>
        </div>
        <div className="card overflow-hidden mt-4">
          <div className="section-banner">Media</div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="shimmer h-12 rounded-lg" />
            <div className="shimmer h-14 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!info) return null;
  const groups = groupFormats(formats);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto flex flex-col gap-4"
    >
      {/* Information Card */}
      <div className="card overflow-hidden">
        <div className="section-banner">Information</div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: embed */}
          <div>
            <div className="w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl">
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                  title={info.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              ) : (
                <img src={info.thumbnail_url} alt={info.title} className="w-full h-full object-cover" />
              )}
            </div>
          </div>

          {/* Right: meta */}
          <div className="flex flex-col gap-4">
            {/* Author */}
            {info.author && (
              <motion.a
                href={info.channel_url || '#'}
                target="_blank"
                rel="noreferrer"
                className="author-chip hover:opacity-80 transition w-fit"
                whileHover={{ x: 2 }}
              >
                <span className="ico"><User className="w-3.5 h-3.5" /></span>
                {info.author}
              </motion.a>
            )}

            {/* Title */}
            <h1 className="text-xl lg:text-2xl font-bold leading-snug text-white">{info.title}</h1>

            {/* Stats */}
            <div className="flex flex-wrap gap-3 text-xs text-[var(--color-muted-foreground)]">
              {info.views != null && (
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmtViews(info.views)} views</span>
              )}
              {info.likes && (
                <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{info.likes}</span>
              )}
              {info.publish_date && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{info.publish_date.slice(0, 10)}</span>
              )}
            </div>

            {/* Description */}
            {info.description && (
              <div>
                <p className={`text-sm text-[var(--color-muted-foreground)] leading-relaxed ${descExpanded ? '' : 'line-clamp-4'}`}>
                  {info.description}
                </p>
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="mt-1 flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-white transition-colors"
                >
                  {descExpanded
                    ? <><ChevronUp className="w-3 h-3" /> Show less</>
                    : <><ChevronDown className="w-3 h-3" /> Show more</>}
                </button>
              </div>
            )}

            {/* Duration + badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="duration-chip">
                <Clock className="w-3.5 h-3.5" />{fmtDuration(info.length_seconds)}
              </div>
              {info.is_shorts && <span className="badge badge-green">SHORT</span>}
              {info.is_live   && <span className="badge badge-red">LIVE</span>}
              {info.is_age_restricted && <span className="badge badge-amber">18+</span>}
            </div>

            {/* Action links */}
            <div className="flex flex-wrap gap-2 mt-auto">
              {info.captions_available && (
                <motion.button
                  onClick={onOpenCaptions}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-[var(--color-surface2)] border border-[var(--color-border)] hover:border-[var(--color-border2)] hover:text-white text-[var(--color-muted-foreground)] transition-all"
                >
                  <CaptionsIcon className="w-3.5 h-3.5" />
                  {info.caption_languages?.length ? `${info.caption_languages.length} Captions` : 'Captions'}
                </motion.button>
              )}
              <motion.a
                href={info.watch_url}
                target="_blank"
                rel="noreferrer"
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-[var(--color-surface2)] border border-[var(--color-border)] hover:border-[var(--color-border2)] hover:text-white text-[var(--color-muted-foreground)] transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" /> YouTube
              </motion.a>
            </div>
          </div>
        </div>
      </div>

      {/* Media Card */}
      {formats.length > 0 && (
        <div className="card overflow-hidden">
          <div className="section-banner">Media</div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Format picker */}
            <div>
              <p className="section-title mb-3">Select Format</p>

              {/* Trigger (white pill) */}
              <button
                onClick={() => setPickerOpen((o) => !o)}
                disabled={['progress', 'starting', 'queued'].includes(dlState.s)}
                className={`format-trigger ${pickerOpen ? 'open' : ''}`}
              >
                <span className="truncate">{selected?.label || 'Select format'}</span>
                <ChevronDown className="chevron w-5 h-5 shrink-0" />
              </button>

              {/* Expanded dropdown */}
              <AnimatePresence>
                {pickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="format-list">
                      {groups.map(({ label, items }) => (
                        <div key={label}>
                          <div className="format-list-group flex items-center gap-2">
                            {label === 'High Quality (Merge)' && <Zap className="w-3 h-3" />}
                            {label}
                          </div>
                          {items.map((fmt) => (
                            <button
                              key={fmt.id}
                              onClick={() => { setSelected(fmt); setPickerOpen(false); setDlState({ s: 'idle' }); }}
                              className={`format-row w-full text-left ${selected?.id === fmt.id ? 'selected' : ''}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{fmt.label}</div>
                                {fmt.sub && <div className="text-xs row-sub text-[var(--color-muted-foreground)] font-mono mt-0.5 truncate">{fmt.sub}</div>}
                              </div>
                              {fmt.filesize_mb && (
                                <span className="text-xs font-mono shrink-0 opacity-70">{fmtMB(fmt.filesize_mb)}</span>
                              )}
                              <div className="radio-dot" />
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Download action */}
            <div>
              <p className="section-title mb-3">Download</p>

              <div className="size-divider">
                <span>File Size: <strong className="text-white">{selected?.filesize_mb ? fmtMB(selected.filesize_mb) : 'auto'}</strong></span>
              </div>

              <DownloadBtn state={dlState} onClick={handleDownload} onRetry={() => setDlState({ s: 'idle' })} />

              <p className="text-center text-[11px] text-[var(--color-muted-foreground)] mt-3">
                By downloading, you agree to our terms and conditions
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Another URL */}
      <motion.button
        onClick={onAnotherUrl}
        className="btn-card"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <RotateCw className="w-4 h-4" /> Download Another URL
      </motion.button>

      {/* Chapters */}
      {info.chapters?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card overflow-hidden"
        >
          <div className="section-banner">Chapters ({info.chapters.length})</div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
            {info.chapters.map((c: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--color-surface2)] rounded-lg transition cursor-default"
              >
                <span className="font-mono text-xs text-[var(--color-primary)] w-14 shrink-0">{fmtDuration(c.start_seconds)}</span>
                <span className="text-sm text-white/80 line-clamp-1">{c.title}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Keywords */}
      {info.keywords?.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="card p-5"
        >
          <p className="section-title">Keywords</p>
          <div className="flex flex-wrap gap-2">
            {info.keywords.slice(0, 24).map((kw: string) => (
              <motion.span
                key={kw}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs bg-[var(--color-surface2)] border border-[var(--color-border)] px-3 py-1 rounded-full text-[var(--color-muted-foreground)] hover:border-[var(--color-border2)] hover:text-white transition cursor-default"
              >
                {kw}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function DownloadBtn({ state, onClick, onRetry }: { state: DlState; onClick: () => void; onRetry: () => void }) {
  if (state.s === 'idle') return (
    <motion.button onClick={onClick} className="btn-card" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
      <Download className="w-4 h-4" /> Download
    </motion.button>
  );
  if (state.s === 'starting') return (
    <button className="btn-card" disabled>
      <Loader2 className="w-4 h-4 animate-spin" /> Starting…
    </button>
  );
  if (state.s === 'queued') return (
    <button className="btn-card" disabled>
      <Loader2 className="w-4 h-4 animate-spin" /> Your media is currently queued for processing. (1)
    </button>
  );
  if (state.s === 'progress') {
    const pct = Math.max(state.pct, 0.1);
    return (
      <div className="flex flex-col gap-2">
        <button className="btn-card relative" disabled>
          <motion.div
            className="absolute inset-y-0 left-0 bg-[var(--color-surface3)] rounded-l-[0.625rem]"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
          <span className="relative z-10 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {state.done_mb != null && state.total_mb
              ? `${state.done_mb.toFixed(2)} MB / ${state.total_mb.toFixed(2)} MB (${pct.toFixed(0)}%)`
              : `${pct.toFixed(1)}% · ${state.phase === 'merging' ? 'Merging…' : 'Downloading…'}`}
          </span>
        </button>
        {state.speed != null && state.speed > 0 && (
          <p className="text-center text-[11px] text-[var(--color-muted-foreground)] font-mono">
            {state.speed.toFixed(1)} MB/s · {state.phase}
          </p>
        )}
      </div>
    );
  }
  if (state.s === 'done') return (
    <motion.a href={state.url} target="_blank" rel="noreferrer" className="btn-card done" whileHover={{ scale: 1.01 }}>
      <CheckCircle2 className="w-4 h-4" /> Save File
    </motion.a>
  );
  if (state.s === 'error') return (
    <div className="flex flex-col gap-2">
      <button className="btn-card error" disabled>
        <AlertCircle className="w-4 h-4" /> {state.msg}
      </button>
      <button onClick={onRetry} className="btn btn-outline w-full">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );
  return null;
}
