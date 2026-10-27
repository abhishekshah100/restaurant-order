'use client';

import { useEffect, useRef } from 'react';
import type { KitchenTicket } from '@/lib/kitchenBoard';
import { playChime } from '../shell/kitchenSound';

/** A ticket left in New this long is a reminder's reason. */
const WAITING_MS = 2 * 60_000;
const EVERY_MS = 60_000;

/**
 * While `enabled`, a soft chime every minute as long as some ticket has waited in New for over
 * two minutes (nobody's started it), so a busy kitchen doesn't forget it.
 */
export function useWaitingReminder(
  tickets: readonly KitchenTicket[] | undefined,
  enabled: boolean,
) {
  const latest = useRef(tickets);
  useEffect(() => {
    latest.current = tickets;
  }, [tickets]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const waiting = (latest.current ?? []).some(
        (ticket) => ticket.stage === 'new' && now - Date.parse(ticket.placedAt) > WAITING_MS,
      );
      if (waiting) playChime('reminder');
    }, EVERY_MS);
    return () => window.clearInterval(id);
  }, [enabled]);
}
