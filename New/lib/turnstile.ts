'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { registerTokenGetter } from './api';

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
 * Mount this ONCE at the root (ClientApp). It:
 *   - Renders an invisible widget in the provided `containerRef` div
 *   - Registers its `getToken` into the `fetchApi` module so ALL API calls
 *     anywhere in the app automatically get the Turnstile token attached —
 *     no prop drilling needed.
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

  /** Returns the current valid token, waiting for the challenge if needed. */
  const getToken = useCallback((): Promise<string> => {
    if (!SITE_KEY) return Promise.resolve('');           // dev: no key = skip
    if (tokenRef.current) return Promise.resolve(tokenRef.current);
    return new Promise((resolve) => { resolversRef.current.push(resolve); });
  }, []);

  const reset = useCallback(() => {
    tokenRef.current = null;
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    loadTurnstileScript().then(() => {
      if (!window.turnstile || !containerRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey:          SITE_KEY,
        callback:         onSuccess,
        theme:            'dark',
        size:             'invisible',
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

  // Register getToken into fetchApi so every API call gets the token for free.
  useEffect(() => {
    registerTokenGetter(getToken);
    return () => registerTokenGetter(null);   // cleanup on unmount
  }, [getToken]);

  return { containerRef, getToken, reset, ready };
}
