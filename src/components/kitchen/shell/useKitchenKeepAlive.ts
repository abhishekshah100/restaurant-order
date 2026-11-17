'use client';

import { useEffect } from 'react';
import { localStore, writeLastActive } from '@/lib/idleSignOut';

/** How often an open kitchen screen says the device is in use. */
const BEAT_MS = 60_000;
const USE_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

/**
 * The kitchen display stays signed in all service, even when nobody touches it for a while. The
 * sign-in is the device's, shared with any admin tab open beside it, and that tab signs the
 * device out after 30 minutes of nobody using staff screens (lib/idleSignOut). So while a kitchen
 * page is open and on screen, it counts as use: once a minute, and at every tap or key. Hidden
 * (another app on top, the screen off) it doesn't, so the usual 30 minutes run from then.
 */
export function useKitchenKeepAlive() {
  useEffect(() => {
    const storage = localStore();
    const beat = () => {
      if (document.visibilityState === 'visible') writeLastActive(storage, Date.now());
    };
    beat();
    const timer = setInterval(beat, BEAT_MS);
    document.addEventListener('visibilitychange', beat);
    for (const name of USE_EVENTS) window.addEventListener(name, beat, { passive: true });
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
      for (const name of USE_EVENTS) window.removeEventListener(name, beat);
    };
  }, []);
}
