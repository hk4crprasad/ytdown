'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../lib/api';
import { Download, CheckCircle2, AlertCircle, X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface JobCtx {
  activeJobs: string[];
  addJob: (id: string) => void;
  removeJob: (id: string) => void;
}

const JobContext = createContext<JobCtx>({ activeJobs: [], addJob: () => {}, removeJob: () => {} });

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [activeJobs, setActiveJobs] = useState<string[]>([]);
  const addJob    = (id: string) => setActiveJobs((p) => p.includes(id) ? p : [...p, id]);
  const removeJob = (id: string) => setActiveJobs((p) => p.filter((j) => j !== id));
  return <JobContext.Provider value={{ activeJobs, addJob, removeJob }}>{children}</JobContext.Provider>;
}

export const useJobs = () => useContext(JobContext);

export default function ActiveJobs() {
  const { activeJobs } = useJobs();
  if (!activeJobs.length) return null;

  return (
    <div className="fixed bottom-5 right-4 sm:right-6 flex flex-col gap-3 z-50 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
      <AnimatePresence>
        {activeJobs.map((id) => (
          <div key={id} className="pointer-events-auto">
            <JobTracker jobId={id} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function JobTracker({ jobId }: { jobId: string }) {
  const { removeJob } = useJobs();
  const [state, setState] = useState<any>({ status: 'connecting', overall_pct: 0 });

  useEffect(() => {
    let src: EventSource | null = null;
    try {
      src = new EventSource(`${API_URL}/merge/progress/${jobId}`);
      src.onmessage = (e) => {
        const d = JSON.parse(e.data);
        setState(d);
        if (d._eof || d.status === 'done' || d.status === 'error') src?.close();
      };
      src.onerror = () => {
        setState((p: any) => ({ ...p, status: 'error', error: 'Connection lost' }));
        src?.close();
      };
    } catch { setState({ status: 'error', error: 'Failed to connect' }); }
    return () => src?.close();
  }, [jobId]);

  const isDone  = state.status === 'done'  || state._eof;
  const isError = state.status === 'error';
  const pct     = Math.max(state.overall_pct || 0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.92 }}
      className="card p-4 relative overflow-hidden"
      style={{
        borderColor: isDone ? 'var(--color-accent)' : isError ? 'var(--color-primary)' : 'var(--color-primary)',
        borderLeftWidth: '3px',
      }}
    >
      {/* Background progress */}
      {!isDone && !isError && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'rgba(239,68,68,0.08)',
            clipPath: `inset(0 ${100 - pct}% 0 0)`,
            transition: 'clip-path 0.4s ease',
          }}
        />
      )}

      <div className="relative flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {isDone ? (
            <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
          ) : isError ? (
            <AlertCircle className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
          ) : (
            <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          <span className="text-sm font-semibold truncate">{state.title || 'Downloading…'}</span>
        </div>
        <button onClick={() => removeJob(jobId)} className="text-[var(--color-muted-foreground)] hover:text-white transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-mono font-bold text-[var(--color-muted-foreground)]">
            {isError ? 'Error' : state.phase || state.status}
          </p>
          {!isDone && !isError && state.eta_seconds > 0 && (
            <p className="text-[10px] text-[var(--color-muted-foreground)] font-mono mt-0.5">ETA {Math.ceil(state.eta_seconds)}s</p>
          )}
        </div>
        {!isDone && !isError && (
          <span className="font-mono font-bold text-lg leading-none">
            {pct.toFixed(1)}<span className="text-xs text-[var(--color-muted-foreground)]">%</span>
          </span>
        )}
        {isDone && state.download_url && (
          <a
            href={`${API_URL}${state.download_url}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs bg-[var(--color-accent)] text-black font-bold px-3 py-1.5 rounded-full hover:brightness-110 transition"
          >
            <Download className="w-3 h-3" /> Save File
          </a>
        )}
      </div>

      {/* Progress bar */}
        {!isDone && !isError && (
          <div className="relative mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[var(--color-primary)] rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        )}
    </motion.div>
  );
}
