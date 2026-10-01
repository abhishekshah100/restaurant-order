'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during prerender and the hydration pass, true afterwards.
 * Use it to gate anything that depends on browser-only state (localStorage, URL)
 * so server HTML and the first client render always match.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
