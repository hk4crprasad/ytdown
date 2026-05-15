import { useState, useRef, useCallback } from 'react';
import { api } from '../api';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined leading-none ${className}`}>{name}</span>;
}

export default function TokenTab() {
  const [status, setStatus]   = useState(null);
  const [msg, setMsg]         = useState('');
  const [msgType, setMsgType] = useState('');
  const [loading, setLoading] = useState(false);
  const [drag, setDrag]       = useState(false);
  const inputRef              = useRef();

  const checkStatus = async () => {
    setLoading(true);
    try { setStatus(await api.tokenStatus()); }
    catch { setMsg('Failed to reach API.'); setMsgType('error'); }
    finally { setLoading(false); }
  };

  const upload = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) { setMsg('Only .json files accepted.'); setMsgType('error'); return; }
    setLoading(true); setMsg('');
    try {
      const res = await api.uploadToken(file);
      if (res.success) { setMsg(res.message); setMsgType('success'); await checkStatus(); }
      else { setMsg(res.detail||'Upload failed.'); setMsgType('error'); }
    } catch(e) { setMsg(e.message||'Upload error.'); setMsgType('error'); }
    finally { setLoading(false); }
  };

  const onDrop = useCallback(e => {
    e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]);
  }, []);

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      {/* Header */}
      <div className="glass-panel glass-panel-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <Icon name="key" className="text-primary text-[22px]"/>
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">OAuth Token Manager</span>
        </div>
        <p className="text-body-sm text-on-surface-variant mt-3">
          Upload your <code className="font-mono bg-surface-container px-1.5 py-0.5 rounded text-primary">tokens.json</code> for age-restricted or private video access. Hot-reloaded — no server restart needed.
        </p>
      </div>

      {/* Message */}
      {msg && (
        <div className={`glass-panel rounded-xl px-4 py-3 flex items-center gap-3 text-body-sm ${msgType==='success'?'border-green-500/30 text-green-400':'border-error/30 text-error'}`}>
          <Icon name={msgType==='success'?'check_circle':'error'} className="text-[18px]"/>{msg}
        </div>
      )}

      {/* Drop zone */}
      <div
        id="token-drop-zone"
        className={`glass-panel glass-panel-border rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${drag?'border-primary/50 bg-primary/5':'hover:border-outline-variant'}`}
        onDragOver={e=>{e.preventDefault();setDrag(true);}}
        onDragLeave={()=>setDrag(false)}
        onDrop={onDrop}
        onClick={()=>inputRef.current?.click()}
      >
        <Icon name={loading?'hourglass_empty':'upload_file'} className={`text-[44px] ${drag?'text-primary':'text-on-surface-variant/40'}`}/>
        <div className="text-body-md font-medium text-on-surface">
          {loading ? 'Uploading…' : 'Drop tokens.json here'}
        </div>
        <div className="text-body-sm text-on-surface-variant">or click to browse</div>
        <input ref={inputRef} id="token-file-input" type="file" accept=".json" className="hidden"
          onChange={e=>upload(e.target.files[0])}/>
      </div>

      {/* Status */}
      <div className="glass-panel glass-panel-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Token Status</span>
          <button id="check-status-btn"
            className="btn-ghost rounded-lg px-3 py-1.5 text-label-sm text-on-surface-variant flex items-center gap-1.5"
            onClick={checkStatus} disabled={loading}>
            {loading?<span className="w-3.5 h-3.5 border-2 border-outline-variant border-t-primary rounded-full animate-spin"/>:<Icon name="refresh" className="text-[16px]"/>}
            Check
          </button>
        </div>
        {status ? (
          <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
            {[
              ['File',   status.exists?'Present':'Missing', status.exists],
              ['JSON',   status.valid?'Valid':'Invalid',    status.valid],
              ['Auth',   status.ready?'Ready':'Not Ready',  status.ready],
            ].map(([label,val,ok])=>(
              <div key={label} className="p-5">
                <div className="text-label-xs text-on-surface-variant uppercase tracking-wider mb-2">{label}</div>
                <div className={`text-body-md font-semibold flex items-center gap-1.5 ${ok?'text-green-400':'text-error'}`}>
                  <Icon name={ok?'check_circle':'cancel'} className="text-[18px]"/>{val}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-body-sm text-on-surface-variant">
            Click "Check" to see current token status
          </div>
        )}
        {status?.size && (
          <div className="px-5 py-3 border-t border-white/[0.06] text-label-sm text-on-surface-variant flex items-center gap-2">
            <Icon name="info" className="text-[14px]"/>{(status.size/1024).toFixed(1)} KB · Tokens are hot-reloaded, old tokens are auto-backed up.
          </div>
        )}
      </div>
    </div>
  );
}
