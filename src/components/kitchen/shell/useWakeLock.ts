'use client';

import { useEffect } from 'react';

/**
 * Keeps the screen on while `enabled` (the Screen Wake Lock API): the lock goes when the tab is
 * hidden, so it's asked for again when the kitchen comes back to it. Does nothing where the
 * browser has no wake lock.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const request = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then(
        (sentinel) => {
          if (stopped) void sentinel.release();
          else lock = sentinel;
        },
        () => {
          // Refused (battery saver, a policy): the screen dims as usual.
        },
      );
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release();
    };
  }, [enabled]);
}

/** Whether this browser can keep the screen on. */
export const canKeepAwake = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
