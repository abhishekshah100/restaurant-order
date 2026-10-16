'use client';

import { useNow } from '@/hooks/useNow';
import { elapsedClock } from '@/lib/kitchenBoard';

/**
 * A ticket's running clock ("12:05") since `since`, ticking every second. Each ticket ticks on
 * its own, so the board around it doesn't re-render every second. Empty until hydrated.
 */
export function TicketTimer({ since, label }: { since: string; label: (time: string) => string }) {
  const now = useNow(1000);
  if (!now) return null;
  const time = elapsedClock(now.getTime() - Date.parse(since));
  return (
    <span role="timer" aria-label={label(time)}>
      {time}
    </span>
  );
}
