'use client';

import { useCallback, useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
};

/** Full screen offered (not on iPhone Safari) and on; both off in the prerendered HTML. */
const isSupported = () => document.fullscreenEnabled === true;
const isActive = () => document.fullscreenElement !== null;
const never = () => false;

/** The page in full screen (a kitchen's wall screen): whether it's offered, whether it's on, a toggle. */
export function useFullscreen() {
  const supported = useSyncExternalStore(subscribe, isSupported, never);
  const active = useSyncExternalStore(subscribe, isActive, never);

  const toggle = useCallback(() => {
    // The browser can refuse (no user gesture, a policy); the button just stays as it was.
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    void request.catch(() => undefined);
  }, []);

  return { supported, active, toggle };
}
