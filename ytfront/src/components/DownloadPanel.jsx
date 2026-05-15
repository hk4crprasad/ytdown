import { useState } from 'react';
import { useQueue } from '../context/QueueContext';
import { api } from '../api';

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined leading-none ${className}`}>{name}</span>;
}

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024**2) return `${(b/1024).toFixed(0)} KB`;
  return `${(b/1024**2).toFixed(1)} MB`;
}
function fmtEta(s) {
  if (!s||s<=0) return '';
  return s<60?`${Math.ceil(s)}s`:`${Math.floor(s/60)}m ${Math.ceil(s%60)}s`;
}

function PBar({ pct, variant = 'default', label, right }) {
  const done = pct >= 100;
  const cls = done ? 'done' : variant === 'audio' ? '' : variant === 'merge' ? 'done' : '';
  return (
    <div className="mb-2">
      <div className="flex justify-between mb-1">
        <span className="text-label-xs text-on-surface-variant">{label}</span>
        <span className="text-label-xs text-on-surface font-mono">{right}</span>
      </div>
      <div className="progress-bar-bg">
        <div className={`progress-bar-fill ${cls}`} style={{width:`${Math.min(pct,100)}%`}}/>
      </div>
    </div>
  );
}

function JobCard({ job }) {
  const { removeJob } = useQueue();
  const isActive = !['done','error'].includes(job.status);
  const thumbUrl = job.video_id ? `https://img.youtube.com/vi/${job.video_id}/default.jpg` : null;

  const statusIcon = { queued:'schedule', downloading:'download', merging:'merge', done:'check_circle', error:'error' }[job.status] || 'pending';
  const statusColor = { done:'text-green-400', error:'text-error', downloading:'text-secondary', merging:'text-tertiary' }[job.status] || 'text-on-surface-variant';

  return (
    <div className="bg-surface-container rounded-xl p-3.5 border border-white/[0.06] transition-all hover:border-white/[0.1]">
      {/* Header */}
      <div className="flex gap-3 mb-3">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-14 h-8 rounded-lg object-cover flex-shrink-0 bg-surface-container-high"/>
        ) : (
          <div className="w-14 h-8 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
            <Icon name="smart_display" className="text-on-surface-variant/40 text-[16px]"/>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-body-sm font-medium text-on-surface truncate">{job.title||'Loading…'}</div>
          <div className={`text-label-xs flex items-center gap-1 mt-0.5 ${statusColor}`}>
            <Icon name={statusIcon} className="text-[12px]"/>
            {job.status}
            {job.video_res && ` · ${job.video_res}`}
            {job.eta_seconds > 0 && isActive && ` · ${fmtEta(job.eta_seconds)} left`}
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          {job.status === 'done' && (
            <a href={api.fileUrl(job.job_id)} download
              className="btn-primary rounded-lg px-2.5 py-1 text-label-xs text-white no-underline flex items-center gap-1">
              <Icon name="save_alt" className="text-[12px]"/>Save
            </a>
          )}
          <button onClick={()=>removeJob(job.job_id)}
            className="btn-ghost rounded-lg p-1.5 text-on-surface-variant hover:text-error transition-colors">
            <Icon name="close" className="text-[14px]"/>
          </button>
        </div>
      </div>

      {/* Progress */}
      {job.status !== 'error' && (
        <div>
          <PBar pct={job.overall_pct||0} label="Overall" right={`${(job.overall_pct||0).toFixed(0)}%`}/>
          {job.video_bytes_total > 0 && (
            <PBar pct={job.video_pct||0} variant="video"
              label={`Video ${fmtBytes(job.video_bytes_done)} / ${fmtBytes(job.video_bytes_total)}`}
              right={job.video_speed_mbps>0?`${job.video_speed_mbps.toFixed(1)} MB/s`:''}/>
          )}
          {job.audio_bytes_total > 0 && (
            <PBar pct={job.audio_pct||0} variant="audio"
              label={`Audio ${fmtBytes(job.audio_bytes_done)} / ${fmtBytes(job.audio_bytes_total)}`}
              right={job.audio_abr||''}/>
          )}
          {(job.status==='merging'||job.merge_pct>0) && (
            <PBar pct={job.merge_pct||0} variant="merge" label="FFmpeg Merge" right={`${(job.merge_pct||0).toFixed(0)}%`}/>
          )}
        </div>
      )}

      {job.status === 'error' && (
        <div className="rounded-lg px-3 py-2 bg-error/10 border border-error/20 text-error text-label-xs flex items-center gap-2">
          <Icon name="error" className="text-[14px] flex-shrink-0"/>{job.error}
        </div>
      )}
    </div>
  );
}

export default function DownloadPanel() {
  const { jobs, removeJob } = useQueue();
  const [minimized, setMinimized] = useState(false);

  const jobList = Object.values(jobs);
  if (jobList.length === 0) return null;

  const active  = jobList.filter(j=>!['done','error'].includes(j.status)).length;
  const done    = jobList.filter(j=>j.status==='done').length;
  const errored = jobList.filter(j=>j.status==='error').length;

  return (
    <div className={`fixed bottom-5 right-5 z-50 w-[380px] rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.6)] border border-white/[0.08] transition-all ${minimized?'max-h-[58px]':'max-h-[580px]'}`}
      style={{background:'rgba(6,6,8,0.92)',backdropFilter:'blur(32px)',WebkitBackdropFilter:'blur(32px)'}}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none"
        style={{background:'linear-gradient(135deg,#842bd2,#0566d9)'}}
        onClick={()=>setMinimized(m=>!m)}>
        <div className="flex items-center gap-2.5">
          <Icon name="download" className="text-white text-[18px]"/>
          <span className="text-label-sm text-white font-semibold uppercase tracking-wider">Downloads</span>
          {active>0 && <span className="bg-white/20 text-white rounded-full px-2 py-0.5 text-label-xs">{active} active</span>}
          {done>0   && <span className="bg-green-500/30 text-green-300 rounded-full px-2 py-0.5 text-label-xs">{done} done</span>}
          {errored>0 && <span className="bg-error/30 text-error rounded-full px-2 py-0.5 text-label-xs">{errored} failed</span>}
        </div>
        <div className="flex items-center gap-2">
          {(done+errored>0) && (
            <button className="text-white/70 hover:text-white text-label-xs transition-colors"
              onClick={e=>{e.stopPropagation();jobList.filter(j=>['done','error'].includes(j.status)).forEach(j=>removeJob(j.job_id));}}>
              Clear
            </button>
          )}
          <Icon name={minimized?'expand_less':'expand_more'} className="text-white text-[20px]"/>
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <div className="overflow-y-auto max-h-[512px] p-3 flex flex-col gap-2.5">
          {jobList.map(job => <JobCard key={job.job_id} job={job}/>)}
        </div>
      )}
    </div>
  );
}
