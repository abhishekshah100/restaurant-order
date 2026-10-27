'use client';

import { useEffect, useState } from 'react';
import { audioContext } from './kitchenSound';

/**
 * Whether sound still needs a tap before it can play (browsers block it until the page is
 * touched), while `wanted`. The first tap or key anywhere allows it.
 */
export function useSoundUnlock(wanted: boolean): boolean {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!wanted) return;
    const ctx = audioContext();
    if (!ctx) return;
    const sync = () => setBlocked(ctx.state !== 'running');
    const unlock = () => void ctx.resume().then(sync);
    // Some browsers allow it straight away (a tap earlier in the visit).
    void ctx.resume().then(sync);
    ctx.addEventListener('statechange', sync);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      ctx.removeEventListener('statechange', sync);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [wanted]);

  return wanted && blocked;
}
