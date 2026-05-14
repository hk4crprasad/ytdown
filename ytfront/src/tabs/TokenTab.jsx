import { useState, useRef, useCallback } from 'react';
import { api } from '../api';

export default function TokenTab({ onUpload }) {
  const [status, setStatus]   = useState(null);
  const [msg, setMsg]         = useState('');
  const [msgType, setMsgType] = useState('');
  const [loading, setLoading] = useState(false);
  const [drag, setDrag]       = useState(false);
  const inputRef              = useRef();

  const checkStatus = async () => {
    setLoading(true);
    try {
      const s = await api.tokenStatus();
      setStatus(s);
    } catch { setMsg('Failed to reach API.'); setMsgType('error'); }
    finally { setLoading(false); }
  };

  const upload = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setMsg('Only .json files are accepted.'); setMsgType('error'); return;
    }
    setLoading(true); setMsg('');
    try {
      const res = await api.uploadToken(file);
      if (res.success) {
        setMsg(res.message); setMsgType('success');
        onUpload && onUpload();
        await checkStatus();
      } else {
        setMsg(res.detail || 'Upload failed.'); setMsgType('error');
      }
    } catch(e) {
      setMsg(e.message || 'Upload error.'); setMsgType('error');
    } finally { setLoading(false); }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, []);

  return (
    <>
      <h1 className="section-title">Token Manager</h1>
      <p className="section-sub">Upload your <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent2)', fontSize: '0.85rem' }}>tokens.json</code> for authenticated requests (age-restricted, private videos).</p>

      {msg && (
        <div className={`alert ${msgType === 'success' ? 'alert-success' : 'alert-error'}`}>
          {msgType === 'success' ? '✓' : '⚠'} {msg}
        </div>
      )}

      {/* Drop zone */}
      <div className="card">
        <div className="card-header"><span className="card-title">Upload Token File</span></div>
        <div
          className={`drop-zone ${drag ? 'drag' : ''}`}
          id="token-drop-zone"
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 0.75rem' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>
            {loading ? 'Uploading...' : 'Drop tokens.json here or click to browse'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>Must be a valid JSON file</p>
          <input
            ref={inputRef}
            id="token-file-input"
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => upload(e.target.files[0])}
          />
        </div>
      </div>

      {/* Status card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Token Status</span>
          <button id="check-status-btn" className="btn btn-ghost btn-sm" onClick={checkStatus} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Refresh'}
          </button>
        </div>

        {status ? (
          <div className="stat-row">
            <div className="stat">
              <div className="stat-val" style={{ color: status.exists ? 'var(--green)' : 'var(--red)' }}>
                {status.exists ? 'Present' : 'Missing'}
              </div>
              <div className="stat-key">File</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color: status.valid ? 'var(--green)' : 'var(--red)' }}>
                {status.valid ? 'Valid JSON' : 'Invalid'}
              </div>
              <div className="stat-key">Format</div>
            </div>
            <div className="stat">
              <div className="stat-val" style={{ color: status.ready ? 'var(--green)' : 'var(--yellow)' }}>
                {status.ready ? 'Ready' : 'Not Ready'}
              </div>
              <div className="stat-key">Auth</div>
            </div>
            {status.size && (
              <div className="stat">
                <div className="stat-val">{(status.size / 1024).toFixed(1)} KB</div>
                <div className="stat-key">Size</div>
              </div>
            )}
            {status.last_updated && (
              <div className="stat">
                <div className="stat-val" style={{ fontSize: '0.85rem' }}>{status.last_updated.slice(0,16).replace('T', ' ')}</div>
                <div className="stat-key">Last Updated</div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty" style={{ padding: '1.5rem' }}>
            <p>Click Refresh to check current token status</p>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="alert alert-info">
        ℹ The server picks up new tokens <strong>immediately</strong> — no restart needed.
        Old tokens are automatically backed up in <code style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>token_backups/</code>.
      </div>
    </>
  );
}
