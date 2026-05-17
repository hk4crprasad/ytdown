'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { fetchApi, API_URL } from '../lib/api';
import { toast } from 'sonner';
import { X, Upload, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

export default function ConfigModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/token/status')
      .then((res) => { setStatus(res); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    toast.loading('Uploading token…', { id: 'upload-token' });
    try {
      const res = await fetch(`${API_URL}/upload/token`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to upload token');
      const newStatus = await fetchApi('/token/status');
      setStatus(newStatus);
      toast.success('Token uploaded successfully', { id: 'upload-token' });
    } catch (err: any) {
      toast.error('Upload failed', { id: 'upload-token', description: err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-md card overflow-hidden relative"
      >
        <div className="section-banner flex items-center justify-between">
          <span>Configuration</span>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
            Upload your <code className="text-xs bg-[var(--color-surface2)] px-1.5 py-0.5 rounded font-mono">tokens.json</code> to enable OAuth-authenticated extraction and bypass most bot restrictions.
          </p>

          <div className="card-inset p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-muted-foreground)] mb-2">Token Status</p>
            {loading ? (
              <Loader2 className="w-4 h-4 text-[var(--color-primary)] animate-spin" />
            ) : status?.ready ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[var(--color-accent)]">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-bold text-sm">Authenticated &amp; Ready</span>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)] font-mono">
                  {status.size} bytes{status.last_updated ? ` · Updated ${status.last_updated}` : ''}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[var(--color-primary)]">
                <ShieldAlert className="w-4 h-4" />
                <span className="font-bold text-sm">Missing or Invalid Token</span>
              </div>
            )}
          </div>

          <label className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border border-dashed border-[var(--color-border2)] bg-[var(--color-surface2)] hover:bg-[var(--color-surface3)] cursor-pointer transition-colors group">
            <Upload className="w-4 h-4 text-[var(--color-muted-foreground)] group-hover:text-white transition-colors" />
            <span className="text-sm font-medium">Upload tokens.json</span>
            <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </motion.div>
    </div>
  );
}
