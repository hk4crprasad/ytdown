'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchApi, API_URL } from '../lib/api';
import { toast } from 'sonner';
import {
  Loader2, Download, Languages, Sparkles, Copy, Check,
  ArrowLeft, FileText, FileCode, AlignLeft, Search,
} from 'lucide-react';

type Fmt = 'srt' | 'txt' | 'xml';

const FMT_META: Record<Fmt, { label: string; desc: string; icon: React.ReactNode }> = {
  srt: { label: 'SRT', desc: 'SubRip subtitles', icon: <FileText className="w-3 h-3" /> },
  txt: { label: 'TXT', desc: 'Plain text', icon: <AlignLeft className="w-3 h-3" /> },
  xml: { label: 'XML', desc: 'Raw XML data', icon: <FileCode className="w-3 h-3" /> },
};

export default function CaptionsPanel({ url, onBack }: { url: string; onBack?: () => void }) {
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [activeCap, setActiveCap]   = useState<any | null>(null);
  const [activeFmt, setActiveFmt]   = useState<Fmt>('srt');
  const [preview, setPreview]       = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [search, setSearch]         = useState('');

  useEffect(() => {
    let mounted = true;
    fetchApi(`/captions/list?url=${encodeURIComponent(url)}`)
      .then((res) => { if (mounted) setData(res); })
      .catch((err) => toast.error('Failed to load captions', { description: err.message }))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [url]);

  const loadPreview = async (cap: any, fmt: Fmt) => {
    setActiveCap(cap); setActiveFmt(fmt); setPreviewing(true); setPreview('');
    try {
      const res = await fetchApi(
        `/captions/download?url=${encodeURIComponent(url)}&lang_code=${encodeURIComponent(cap.code)}&fmt=${fmt}`
      );
      setPreview(res.content || '');
    } catch (err: any) {
      toast.error('Failed to preview', { description: err.message });
    } finally {
      setPreviewing(false);
    }
  };

  const saveCap = (cap: any, fmt: Fmt) => {
    window.open(
      `${API_URL}/captions/download?url=${encodeURIComponent(url)}&lang_code=${encodeURIComponent(cap.code)}&fmt=${fmt}&raw=true`,
      '_blank'
    );
  };

  const copyPreview = async () => {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        {onBack && <BackBtn onClick={onBack} />}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <div className="card overflow-hidden">
            <div className="section-banner">Caption Tracks</div>
            <div className="p-4 flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shimmer h-16 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="section-banner">Preview</div>
            <div className="p-4">
              <div className="shimmer h-64 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const allCaps: any[]    = data.captions || [];
  const filtered          = allCaps.filter((c) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.code?.includes(search.toLowerCase())
  );
  const autoCount         = allCaps.filter((c) => c.is_auto_generated).length;
  const manualCount       = allCaps.length - autoCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto flex flex-col gap-4"
    >
      {onBack && <BackBtn onClick={onBack} />}

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-[var(--color-primary)]" />
          <span className="font-display font-bold text-lg text-white">Captions</span>
          <span className="badge badge-gray">{data.total} tracks</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {manualCount > 0 && <span className="badge badge-blue">{manualCount} Manual</span>}
          {autoCount > 0   && <span className="badge badge-amber">{autoCount} Auto-generated</span>}
        </div>
      </div>

      {/* Desktop 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">

        {/* ── Left: Track list ── */}
        <div className="card overflow-hidden lg:sticky lg:top-20">
          <div className="section-banner justify-between">
            <span className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-[var(--color-primary)]" />
              Tracks
            </span>
            <span className="text-xs font-mono text-[var(--color-muted-foreground)]">{filtered.length} shown</span>
          </div>

          {/* Search bar */}
          {allCaps.length > 5 && (
            <div className="p-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg px-3 py-2">
                <Search className="w-3.5 h-3.5 text-[var(--color-muted-foreground)] shrink-0" />
                <input
                  type="text"
                  placeholder="Filter languages…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-[#444]"
                />
              </div>
            </div>
          )}

          {/* Track items */}
          <div className="max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--color-muted-foreground)]">
                No tracks match "{search}"
              </div>
            ) : (
              filtered.map((cap, i) => {
                const isActive = activeCap?.code === cap.code;
                return (
                  <motion.div
                    key={cap.code + i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className={`px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 transition-colors ${
                      isActive ? 'bg-[rgba(239,68,68,0.06)] border-l-2 border-l-[var(--color-primary)]' : 'hover:bg-[var(--color-surface2)]'
                    }`}
                  >
                    {/* Language info */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-xs font-mono text-[var(--color-primary)] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] px-2 py-0.5 rounded font-bold">
                        {cap.code}
                      </span>
                      {cap.is_auto_generated && (
                        <span className="badge badge-amber flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> AUTO
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white mb-2 truncate">{cap.name}</p>

                    {/* Format buttons */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['srt', 'txt', 'xml'] as Fmt[]).map((fmt) => {
                        const meta = FMT_META[fmt];
                        const isPreviewActive = isActive && activeFmt === fmt;
                        return (
                          <div key={fmt} className="flex flex-col gap-1">
                            {/* Preview button */}
                            <button
                              onClick={() => loadPreview(cap, fmt)}
                              className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${
                                isPreviewActive
                                  ? 'bg-[var(--color-primary)] text-white'
                                  : 'bg-[var(--color-surface3)] hover:bg-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-white border border-[var(--color-border)]'
                              }`}
                            >
                              {meta.icon}{meta.label}
                            </button>
                            {/* Save button */}
                            <button
                              onClick={() => saveCap(cap, fmt)}
                              className="flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[var(--color-surface2)] hover:bg-[var(--color-accent)] hover:text-black text-[var(--color-muted-foreground)] transition border border-[var(--color-border)]"
                            >
                              <Download className="w-2.5 h-2.5" /> Save
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Preview panel ── */}
        <div className="card overflow-hidden">
          {!activeCap ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface2)] border border-[var(--color-border)] flex items-center justify-center">
                <Languages className="w-7 h-7 text-[var(--color-muted-foreground)]" />
              </div>
              <div>
                <p className="text-base font-semibold text-white mb-1">No preview selected</p>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  Click a format button on any track to preview the caption content here.
                </p>
              </div>
              {allCaps.length === 0 && (
                <p className="text-sm text-[var(--color-muted-foreground)] mt-2 badge badge-gray">
                  This video has no caption tracks available.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Preview header */}
              <div className="section-banner justify-between">
                <div className="flex items-center gap-2">
                  {FMT_META[activeFmt].icon}
                  <span className="font-semibold">{activeCap.name}</span>
                  <span className="badge badge-gray">{activeFmt.toUpperCase()}</span>
                  {activeCap.is_auto_generated && (
                    <span className="badge badge-amber flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> AUTO
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {/* Download current preview */}
                  <button
                    onClick={() => saveCap(activeCap, activeFmt)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-accent)] hover:text-black text-[var(--color-muted-foreground)] transition border border-[var(--color-border)]"
                  >
                    <Download className="w-3 h-3" /> Download
                  </button>
                  {/* Copy */}
                  <button
                    onClick={copyPreview}
                    disabled={!preview}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface3)] transition disabled:opacity-30 border border-[var(--color-border)]"
                  >
                    {copied
                      ? <><Check className="w-3 h-3 text-[var(--color-accent)]" /> Copied</>
                      : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
              </div>

              {/* Format switcher tabs */}
              <div className="px-4 pt-4 flex gap-2">
                {(['srt', 'txt', 'xml'] as Fmt[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => loadPreview(activeCap, fmt)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                      activeFmt === fmt
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface2)] text-[var(--color-muted-foreground)] hover:text-white border border-[var(--color-border)]'
                    }`}
                  >
                    {FMT_META[fmt].icon}
                    {FMT_META[fmt].label}
                    <span className="text-[9px] normal-case font-normal opacity-70">{FMT_META[fmt].desc}</span>
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-4 min-h-[300px] max-h-[70vh] overflow-auto">
                <AnimatePresence mode="wait">
                  {previewing ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center py-16"
                    >
                      <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
                    </motion.div>
                  ) : (
                    <motion.pre
                      key={`${activeCap.code}-${activeFmt}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs font-mono whitespace-pre-wrap text-white/75 leading-relaxed"
                    >
                      {preview || '(empty response)'}
                    </motion.pre>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-white transition-colors self-start mb-2"
    >
      <ArrowLeft className="w-4 h-4" /> Back to video
    </button>
  );
}
