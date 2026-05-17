export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Turnstile token — module-level singleton
// ---------------------------------------------------------------------------
// useTurnstile() calls registerTokenGetter() once on mount. After that, every
// fetchApi() call automatically attaches the X-CF-Turnstile-Token header with
// no extra code in components.
// ---------------------------------------------------------------------------
type TokenGetter = (() => Promise<string>) | null;
let _getToken: TokenGetter = null;

/** Called by useTurnstile() to register its token getter. */
export function registerTokenGetter(fn: TokenGetter) {
  _getToken = fn;
}

/**
 * Fetch a backend endpoint.
 * Automatically attaches the Cloudflare Turnstile token if useTurnstile()
 * has been mounted (i.e. in production). In local dev without a site key,
 * the header is silently omitted.
 *
 * @param endpoint  - Path relative to API_URL, e.g. `/video/info?url=…`
 * @param options   - Standard RequestInit options
 */
export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Auto-attach Turnstile token if the hook has registered a getter
  if (_getToken) {
    const token = await _getToken();
    if (token) headers['X-CF-Turnstile-Token'] = token;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || errorData?.error?.message || `API error: ${response.statusText}`);
  }

  return response.json();
}
