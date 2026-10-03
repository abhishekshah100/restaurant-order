'use client';

import { useEffect, useState } from 'react';

/**
 * Seconds left until `endsAt` (epoch ms), ticking once a second and stopping at 0.
 * Returns null until mounted so prerendered markup never shows a stale time.
 */
export function useCountdown(endsAt: number | null): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) window.clearInterval(id);
    };
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [endsAt]);

  if (endsAt === null || now === null) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
