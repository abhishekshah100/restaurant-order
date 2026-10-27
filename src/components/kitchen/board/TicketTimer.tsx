'use client';

import { useContent } from '@/api/hooks';
import { useNow } from '@/hooks/useNow';
import { elapsedMinutes } from '@/lib/kitchenBoard';

/** The timer moves on this often: it counts whole minutes. */
const TICK_MS = 10_000;

/**
 * How long a ticket has waited since `since`: "Just in", "12 min", from an hour "1 h 5 min".
 * Each ticket ticks on its own, so the board around it doesn't re-render. Empty until hydrated.
 */
export function TicketTimer({ since, label }: { since: string; label: (time: string) => string }) {
  const t = useContent('kitchen');
  const now = useNow(TICK_MS);
  if (!now) return null;
  const minutes = elapsedMinutes(now.getTime() - Date.parse(since));
  const time =
    minutes === 0
      ? t('ticket.timer.justNow')
      : minutes < 60
        ? t('ticket.timer.minutes', { count: minutes })
        : t('ticket.timer.hours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  return (
    <span role="timer" aria-label={label(time)}>
      {time}
    </span>
  );
}
