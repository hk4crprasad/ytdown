import { useQueue } from '../context/QueueContext';
import { api } from '../api';

function fmt(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

function fmtEta(s) {
  if (!s || s <= 0) return '';
  if (s < 60) return `${Math.ceil(s)}s`;
  return `${Math.floor(s/60)}m ${Math.ceil(s%60)}s`;
}

function PhaseBar({ label, pct, speed, color }) {
  return (
    <div style={{ marginBottom: '0.55rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: '0.72rem', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
          {speed > 0 ? `${speed.toFixed(1)} MB/s · ` : ''}{pct.toFixed(1)}%
        </span>
      </div>
      <div className="progress-bar-wrap">
        <div
          className="progress-bar"
          style={{
            width: `${pct}%`,
            background: color || 'linear-gradient(90deg, var(--accent), var(--accent2))',
          }}
        />
      </div>
    </div>
  );
}

function JobCard({ job }) {
  const { removeJob } = useQueue();

  const statusColor = {
    queued:      'var(--text3)',
    downloading: 'var(--accent2)',
    merging:     'var(--yellow)',
    done:        'var(--green)',
    error:       'var(--red)',
  }[job.status] || 'var(--text3)';

  const phaseLabel = {
    downloading: '⬇ Downloading',
    merging:     '⚙ Merging with FFmpeg',
    done:        '✓ Complete',
    error:       '✗ Failed',
    queued:      '⏳ Queued',
  }[job.status] || job.phase;

  return (
    <div className="card" style={{ marginBottom: '0.75rem', borderColor: job.status === 'error' ? 'rgba(240,82,82,0.3)' : job.status === 'done' ? 'rgba(52,211,153,0.2)' : 'var(--border)' }}>
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '3px' }}>
            {job.title}
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: statusColor, fontWeight: 600 }}>{phaseLabel}</span>
            {job.video_res && <span style={{ fontSize: '0.7rem', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{job.video_res}</span>}
            {job.video_codec && <span style={{ fontSize: '0.7rem', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{job.video_codec}</span>}
            {job.eta_seconds > 0 && job.status === 'downloading' && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>ETA {fmtEta(job.eta_seconds)}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {job.status === 'done' && (
            <a
              href={api.fileUrl(job.job_id)}
              download
              className="btn btn-sm btn-success"
              style={{ textDecoration: 'none' }}
            >
              ↓ Save
            </a>
          )}
          <button className="btn btn-sm btn-danger" onClick={() => removeJob(job.job_id)}>✕</button>
        </div>
      </div>

      {/* Progress bars */}
      {(job.status === 'downloading' || job.status === 'merging' || job.status === 'done') && (
        <div>
          {/* Overall */}
          <PhaseBar
            label="Overall"
            pct={job.overall_pct || 0}
            speed={0}
            color="linear-gradient(90deg, #7c6af7, #a78bfa)"
          />

          {/* Video */}
          {(job.video_bytes_total > 0 || job.video_pct > 0) && (
            <PhaseBar
              label={`Video  ${fmt(job.video_bytes_done)} / ${fmt(job.video_bytes_total)}`}
              pct={job.video_pct || 0}
              speed={job.video_speed_mbps || 0}
              color="linear-gradient(90deg, #f05252, #fb7185)"
            />
          )}

          {/* Audio */}
          {(job.audio_bytes_total > 0 || job.audio_pct > 0) && (
            <PhaseBar
              label={`Audio  ${fmt(job.audio_bytes_done)} / ${fmt(job.audio_bytes_total)}  ${job.audio_abr ? '· ' + job.audio_abr : ''}`}
              pct={job.audio_pct || 0}
              speed={job.audio_speed_mbps || 0}
              color="linear-gradient(90deg, #fbbf24, #f59e0b)"
            />
          )}

          {/* Merge */}
          {(job.status === 'merging' || job.merge_pct > 0) && (
            <PhaseBar
              label="FFmpeg Merge"
              pct={job.merge_pct || 0}
              speed={0}
              color="linear-gradient(90deg, #34d399, #059669)"
            />
          )}
        </div>
      )}

      {job.status === 'error' && (
        <div className="alert alert-error" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
          {job.error}
        </div>
      )}
    </div>
  );
}

export default function DownloadQueue() {
  const { jobs, removeJob } = useQueue();
  const jobList = Object.values(jobs);

  if (jobList.length === 0) return null;

  const active  = jobList.filter(j => !['done','error'].includes(j.status));
  const done    = jobList.filter(j => j.status === 'done');
  const errored = jobList.filter(j => j.status === 'error');

  return (
    <div style={{ marginTop: '2rem' }}>
      <div className="card-header" style={{ marginBottom: '1rem' }}>
        <span className="section-title" style={{ fontSize: '1rem' }}>Download Queue</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {active.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--accent2)' }}>{active.length} active</span>}
          {done.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>{done.length} done</span>}
          {errored.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--red)' }}>{errored.length} failed</span>}
          {done.length + errored.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => [...done, ...errored].forEach(j => removeJob(j.job_id))}
            >
              Clear finished
            </button>
          )}
        </div>
      </div>
      {jobList.map(job => <JobCard key={job.job_id} job={job} />)}
    </div>
  );
}
