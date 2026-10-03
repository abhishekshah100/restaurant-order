'use client';

import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Re-reads navigator.onLine now (the "Try again" button), without waiting for an event. */
export function recheckOnline(): void {
  listeners.forEach((l) => l());
}

/** navigator.onLine plus online/offline events. Assumes online during prerender and hydration. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
