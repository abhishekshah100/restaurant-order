'use client';

import { useSyncExternalStore } from 'react';
import { useEventsConnected } from '@/api/liveEvents';

/** Tickets older than this (polled every 15 s) mean the reads are failing. */
const STALE_MS = 45_000;

export type Connection = 'live' | 'stale' | 'offline';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * How current the board is: offline (the device has no network), stale (the last reads failed,
 * or, without the branch's events, nothing new has come for 45 s), or live (events coming in, or
 * recent reads: while events come in the board reads rarely, so its age says nothing).
 */
export function useConnection(updatedAt: number, failing: boolean, now: Date | null): Connection {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const streaming = useEventsConnected();
  if (!online) return 'offline';
  if (failing) return 'stale';
  if (!streaming && now && updatedAt > 0 && now.getTime() - updatedAt > STALE_MS) return 'stale';
  return 'live';
}
