'use client';

import { useEffect } from 'react';

let locks = 0;

/** Locks body scroll while `active`. Nested locks are reference-counted. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    document.body.classList.add('is-scroll-locked');
    return () => {
      locks -= 1;
      if (locks === 0) document.body.classList.remove('is-scroll-locked');
    };
  }, [active]);
}
