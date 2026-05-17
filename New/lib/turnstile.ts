'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, params: object) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
    };
    onTurnstileLoad?: () => void;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const SCRIPT_ID = 'cf-turnstile-script';

/** Load the Cloudflare Turnstile script once globally. */
function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById(SCRIPT_ID)) {
      // Already injected — wait for it to be ready
      if (window.turnstile) { resolve(); return; }
      window.onTurnstileLoad = resolve;
      return;
    }
    window.onTurnstileLoad = resolve;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

/**
 * useTurnstile — invisible Cloudflare Turnstile hook.
 *
 * Returns:
 *   - `containerRef` — attach to a hidden <div> in your component
 *   - `getToken()`   — call before any protected API request; resolves with the token
 *   - `reset()`      — call after a failed/used token to get a fresh one
 */
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef  = useRef<string | null>(null);
  const tokenRef     = useRef<string | null>(null);
  const resolversRef = useRef<Array<(token: string) => void>>([]);
  const [ready, setReady] = useState(false);

  const onSuccess = useCallback((token: string) => {
    tokenRef.current = token;
    resolversRef.current.forEach((r) => r(token));
    resolversRef.current = [];
  }, []);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    loadTurnstileScript().then(() => {
      if (!window.turnstile || !containerRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey:  SITE_KEY,
        callback: onSuccess,
        theme:    'dark',
        size:     'invisible',   // no UI at all
        'refresh-expired': 'auto',
      });
      setReady(true);
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onSuccess]);

  /** Returns the current token, waiting for the challenge to complete if needed. */
  const getToken = useCallback((): Promise<string> => {
    // No site key configured — return empty string (dev mode / turnstile disabled)
    if (!SITE_KEY) return Promise.resolve('');

    if (tokenRef.current) return Promise.resolve(tokenRef.current);

    return new Promise((resolve) => {
      resolversRef.current.push(resolve);
    });
  }, []);

  const reset = useCallback(() => {
    tokenRef.current = null;
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  return { containerRef, getToken, reset, ready };
}
