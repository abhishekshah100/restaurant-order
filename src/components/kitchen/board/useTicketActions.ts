'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContent } from '@/api/hooks';
import type { KitchenStep } from '@/api/contracts';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { useToast } from '@/context/ToastContext';
import type { KitchenTicket } from '@/lib/kitchenBoard';
import { queueKitchenTap, useKitchenOutbox, waitingTickets } from '../useKitchenOutbox';
import { useTicketWhere } from '../useTicketWhere';

/**
 * Moving tickets on (Start cooking, Mark ready) and back (a recall), and dishes ticked off as
 * plated. Each tap shows at once and goes out from this screen's queue (useKitchenOutbox), so a
 * tap made while the connection is down isn't lost: it's sent when it's back. A polite
 * announcement says what moved; a step forward offers Undo for a few seconds (and `undoLast`
 * for the keyboard's Backspace). `waiting` holds the tickets with a tap not sent yet.
 */
export function useTicketActions() {
  const t = useContent('kitchen');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const whereOf = useTicketWhere();
  const outbox = useKitchenOutbox();
  const waiting = useMemo(() => waitingTickets(outbox), [outbox]);
  const [announcement, setAnnouncement] = useState('');
  // The last step forward, to take back (Undo, Backspace).
  const last = useRef<{ ticket: KitchenTicket; back: KitchenStep } | null>(null);

  const step = useCallback(
    (ticket: KitchenTicket, next: KitchenStep, back = false) => {
      // Its own function, so Undo (in the toast) can send the step back the same way.
      function run(ticket: KitchenTicket, next: KitchenStep, back: boolean) {
        queueKitchenTap({
          kind: 'step',
          branchId: branch.id,
          orderId: ticket.orderId,
          round: ticket.round,
          step: next,
          ...(back ? { back: true as const } : {}),
        });
        const order = ticket.orderId;
        if (back) {
          last.current = null;
          setAnnouncement(
            t(next === 'received' ? 'board.announce.received' : 'board.announce.recalled', {
              order,
            }),
          );
          return;
        }
        setAnnouncement(
          t(next === 'ready' ? 'board.announce.ready' : 'board.announce.preparing', { order }),
        );
        // Taken back to where it was: New, or Cooking.
        const undo = {
          ticket,
          back: ticket.stage === 'cooking' ? 'preparing' : 'received',
        } as const;
        last.current = undo;
        showToast(
          t(next === 'ready' ? 'ticket.undo.ready' : 'ticket.undo.preparing', {
            where: whereOf(ticket),
          }),
          {
            actionLabel: t('ticket.undo.action'),
            onAction: () => run(undo.ticket, undo.back, true),
          },
        );
      }
      run(ticket, next, back);
    },
    [branch.id, showToast, t, whereOf],
  );

  /** Takes back the last step forward (Backspace); nothing once it's been undone. */
  const undoLast = useCallback(() => {
    const undo = last.current;
    if (undo) step(undo.ticket, undo.back, true);
  }, [step]);

  /** Ticks dishes (their places on the ticket) as plated, or unticks them. */
  const setPlated = useCallback(
    (ticket: KitchenTicket, indexes: readonly number[], plated: boolean) => {
      for (const index of indexes) {
        queueKitchenTap({
          kind: 'plated',
          branchId: branch.id,
          orderId: ticket.orderId,
          round: ticket.round,
          index,
          plated,
        });
      }
    },
    [branch.id],
  );

  const togglePlated = useCallback(
    (ticket: KitchenTicket, index: number) =>
      setPlated(ticket, [index], ticket.items[index]?.plated !== true),
    [setPlated],
  );

  return { step, undoLast, waiting, togglePlated, setPlated, announcement, setAnnouncement };
}

/**
 * Says when tickets come in (after the first read, so opening the board doesn't read them all
 * out): one by name, several by count, and hands them to `onArrive` (the chime, printing). Says
 * too when a ticket on the board is changed or cancelled, and calls `onAlert` (a chime): the
 * kitchen may be cooking it.
 */
export function useArrivals(
  tickets: readonly KitchenTicket[] | undefined,
  announce: (message: string) => void,
  onArrive?: (arrived: KitchenTicket[]) => void,
  onAlert?: () => void,
) {
  // The latest callbacks, without re-running the effect when they change.
  const callbacks = useRef({ onArrive, onAlert });
  useEffect(() => {
    callbacks.current = { onArrive, onAlert };
  }, [onArrive, onAlert]);
  const t = useContent('kitchen');
  const whereOf = useTicketWhere();
  const seen = useRef<{
    fresh: Set<string>;
    changed: Map<string, string>;
    cancelled: Set<string>;
  } | null>(null);

  useEffect(() => {
    if (!tickets) return;
    const fresh = tickets.filter((ticket) => ticket.stage === 'new');
    const changed = tickets.filter((ticket) => ticket.changedAt !== undefined);
    const cancelled = tickets.filter((ticket) => ticket.cancelledAt !== undefined);
    const before = seen.current;
    if (before) {
      const arrived = fresh.filter((ticket) => !before.fresh.has(ticket.key));
      if (arrived.length === 1) {
        const [ticket] = arrived;
        announce(
          t.plural('board.announce.new', 1, { where: whereOf(ticket), order: ticket.orderId }),
        );
      } else if (arrived.length > 1) {
        announce(t.plural('board.announce.new', arrived.length));
      }
      if (arrived.length > 0) callbacks.current.onArrive?.(arrived);

      const newlyChanged = changed.filter(
        (ticket) => before.changed.get(ticket.key) !== ticket.changedAt,
      );
      const newlyCancelled = cancelled.filter((ticket) => !before.cancelled.has(ticket.key));
      for (const ticket of newlyChanged) {
        announce(t('board.announce.changed', { order: ticket.orderId }));
      }
      for (const ticket of newlyCancelled) {
        announce(t('board.announce.cancelled', { order: ticket.orderId }));
      }
      if (newlyChanged.length > 0 || newlyCancelled.length > 0) callbacks.current.onAlert?.();
    }
    seen.current = {
      fresh: new Set([...(before?.fresh ?? []), ...fresh.map((ticket) => ticket.key)]),
      changed: new Map(changed.map((ticket) => [ticket.key, ticket.changedAt ?? ''])),
      cancelled: new Set(cancelled.map((ticket) => ticket.key)),
    };
  }, [announce, t, tickets, whereOf]);
}
