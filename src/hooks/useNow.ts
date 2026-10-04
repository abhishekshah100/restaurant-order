'use client';

import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every `everyMs`; null in the prerendered HTML and the first
 * client render, so times shown with it never mismatch on hydration.
 */
export function useNow(everyMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, everyMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [everyMs]);
  return now;
}
