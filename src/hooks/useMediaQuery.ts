'use client';

import { useCallback, useSyncExternalStore } from 'react';

export const DESKTOP_QUERY = '(min-width: 1024px)';
export const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023.98px)';

/** Whether a media query matches right now (in an event handler); false where there's none. */
export const matchesNow = (query: string): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(query).matches;

/**
 * Subscribes to a media query. Returns `false` during prerender and hydration,
 * so only use it for behaviour (sheet vs modal), never for markup the server renders.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
