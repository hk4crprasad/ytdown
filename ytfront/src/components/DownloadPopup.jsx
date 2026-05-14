import { useState, useRef, useCallback } from 'react';
import { useQueue } from '../context/QueueContext';
import { api } from '../api';

function fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024**2) return `${(b/1024).toFixed(0)} KB`;
  return `${(b/1024**2).toFixed(1)} MB`;
}
function fmtEta(s) {
  if (!s||s<=0) return '';
  return s < 60 ? `${Math.ceil(s)}s left` : `${Math.floor(s/60)}m ${Math.ceil(s%60)}s`;
}

function PBar({ pct, cls, label, right }) {
  return (
    <div style={{marginBottom:'4px'}}>
      <div className="phase-label">
        <span>{label}</span>
        <strong>{right}</strong>
      </div>
      <div className="pbar-wrap">
        <div className={`pbar ${cls} ${pct>=100?'pbar-done':''}`} style={{width:`${Math.min(pct,100)}%`}} />
      </div>
    </div>
  );
}

function JobCard({ job }) {
  const { removeJob } = useQueue();

  const isActive = !['done','error'].includes(job.status);
  const statusEmoji = { queued:'⏳', downloading:'⬇', merging:'⚙', done:'✅', error:'❌' }[job.status] || '…';

  return (
    <div className="dl-job-card">
      <div className="dl-job-header">
        <div className="dl-job-info">
          <div className="dl-job-title">{job.title || 'Loading…'}</div>
          <div className="dl-job-meta">
            {statusEmoji} {job.status}
            {job.video_res && ` · ${job.video_res}`}
            {job.eta_seconds > 0 && isActive && ` · ${fmtEta(job.eta_seconds)}`}
          </div>
        </div>
        <div className="dl-job-actions">
          {job.status === 'done' && (
            <a href={api.fileUrl(job.job_id)} download className="btn btn-xs btn-green" style={{textDecoration:'none'}}>
              💾 Save
            </a>
          )}
          <button className="btn btn-xs btn-ghost" onClick={() => removeJob(job.job_id)}>✕</button>
        </div>
      </div>

      {/* Progress bars */}
      {job.status !== 'error' && (
        <div>
          <PBar
            cls="pbar-red" pct={job.overall_pct||0}
            label="Overall"
            right={`${(job.overall_pct||0).toFixed(0)}%`}
          />
          {job.video_bytes_total > 0 && (
            <PBar
              cls="pbar-blue" pct={job.video_pct||0}
              label={`Video ${fmtBytes(job.video_bytes_done)} / ${fmtBytes(job.video_bytes_total)}`}
              right={job.video_speed_mbps > 0 ? `${job.video_speed_mbps.toFixed(1)} MB/s` : ''}
            />
          )}
          {job.audio_bytes_total > 0 && (
            <PBar
              cls="pbar-yellow" pct={job.audio_pct||0}
              label={`Audio ${fmtBytes(job.audio_bytes_done)} / ${fmtBytes(job.audio_bytes_total)}`}
              right={job.audio_abr || ''}
            />
          )}
          {(job.status === 'merging' || job.merge_pct > 0) && (
            <PBar cls="pbar-green" pct={job.merge_pct||0} label="FFmpeg Merge" right={`${(job.merge_pct||0).toFixed(0)}%`} />
          )}
        </div>
      )}

      {job.status === 'error' && (
        <div className="alert alert-error" style={{marginTop:'0.4rem',fontSize:'0.75rem',padding:'0.5rem 0.7rem'}}>
          {job.error}
        </div>
      )}
    </div>
  );
}

export default function DownloadPopup() {
  const { jobs, removeJob } = useQueue();
  const [minimized, setMinimized] = useState(false);

  const jobList = Object.values(jobs);
  if (jobList.length === 0) return null;

  const active   = jobList.filter(j => !['done','error'].includes(j.status)).length;
  const done     = jobList.filter(j => j.status === 'done').length;
  const errored  = jobList.filter(j => j.status === 'error').length;

  return (
    <div className={`dl-popup ${minimized ? 'minimized' : ''}`}>
      <div className="dl-popup-header" onClick={() => setMinimized(m => !m)}>
        <div className="dl-popup-header-left">
          <span style={{fontSize:'1rem'}}>⬇</span>
          <span className="dl-popup-title">Downloads</span>
          {active > 0 && <span className="dl-popup-count">{active} active</span>}
          {done > 0 && <span className="dl-popup-count" style={{background:'rgba(34,197,94,0.3)'}}>{done} done</span>}
          {errored > 0 && <span className="dl-popup-count" style={{background:'rgba(239,68,68,0.3)'}}>{errored} failed</span>}
        </div>
        <div style={{display:'flex',gap:'0.4rem'}}>
          {(done + errored > 0) && (
            <button
              style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:'99px',padding:'0.15rem 0.55rem',fontSize:'0.7rem',cursor:'pointer'}}
              onClick={e => { e.stopPropagation(); jobList.filter(j=>['done','error'].includes(j.status)).forEach(j=>removeJob(j.job_id)); }}
            >
              Clear
            </button>
          )}
          <span style={{color:'#fff',fontSize:'0.9rem'}}>{minimized ? '▲' : '▼'}</span>
        </div>
      </div>
      {!minimized && (
        <div className="dl-popup-body">
          {jobList.map(job => <JobCard key={job.job_id} job={job} />)}
        </div>
      )}
    </div>
  );
}
