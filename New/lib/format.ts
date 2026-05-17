export function fmtDuration(secs: number | null | undefined): string {
  if (!secs && secs !== 0) return '--:--';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function fmtViews(n: number | null | undefined): string {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function fmtBytes(b: number | null | undefined): string {
  if (!b) return '—';
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

export function fmtMB(mb: number | null | undefined): string {
  if (!mb) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export function thumb(videoId: string | null | undefined, quality: 'default' | 'mq' | 'hq' | 'max' = 'mq'): string {
  if (!videoId) return '';
  const map: Record<string, string> = {
    default: 'default',
    mq: 'mqdefault',
    hq: 'hqdefault',
    max: 'maxresdefault',
  };
  return `https://i.ytimg.com/vi/${videoId}/${map[quality]}.jpg`;
}

export function detectUrlType(input: string): 'video' | 'playlist' | 'search' {
  const s = input.trim();
  if (!s) return 'search';
  const isUrl = /youtube\.com\/|youtu\.be\//.test(s);
  if (!isUrl) return 'search';
  if (/[?&]list=/.test(s) && !/[?&]v=/.test(s)) return 'playlist';
  if (s.includes('/playlist?')) return 'playlist';
  return 'video';
}

export function extractVideoId(url: string): string | null {
  const m = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?/]+)/) || url.match(/shorts\/([^?/]+)/);
  return m?.[1] || null;
}
