export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Fetch a backend endpoint.
 *
 * @param endpoint  - Path relative to API_URL, e.g. `/search?q=…`
 * @param options   - Standard RequestInit options
 * @param cfToken   - Cloudflare Turnstile token.  Pass the value returned by
 *                    `useTurnstile().getToken()`.  When omitted (dev / disabled)
 *                    the header is not sent.
 */
export async function fetchApi(
  endpoint: string,
  options: RequestInit = {},
  cfToken?: string,
) {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (cfToken) {
    headers['X-CF-Turnstile-Token'] = cfToken;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || `API error: ${response.statusText}`);
  }

  return response.json();
}
