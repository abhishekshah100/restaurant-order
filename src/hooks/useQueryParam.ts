'use client';

import { useSyncExternalStore } from 'react';

/**
 * URL change notifications. Next's router.push / replace update the address with
 * history.pushState / replaceState, which fire no event, so both are wrapped once
 * (alongside Next's own wrapper) to tell subscribers. Listeners run in a microtask:
 * Next calls these from an insertion effect, where React state can't be updated.
 */
const listeners = new Set<() => void>();
let patched = false;

function notify() {
  queueMicrotask(() => listeners.forEach((l) => l()));
}

function patchHistory() {
  if (patched) return;
  patched = true;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method];
    window.history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      notify();
      return result;
    };
  }
}

function subscribe(onChange: () => void) {
  patchHistory();
  listeners.add(onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('popstate', onChange);
  };
}

/**
 * Reads one query-string value on the client and follows in-app navigation.
 * Returns null during prerender and hydration, so statically exported pages
 * don't need the Suspense boundary that useSearchParams would require.
 */
export function useQueryParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}
