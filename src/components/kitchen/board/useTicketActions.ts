'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useContent } from '@/api/hooks';
import type { KitchenStep } from '@/api/contracts';
import { useSetKitchenStatus, useSetPlated } from '@/api/mutations';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { useToast } from '@/context/ToastContext';
import type { KitchenTicket } from '@/lib/kitchenBoard';
import { useTicketWhere } from '../useTicketWhere';

/**
 * Moving tickets on (Start cooking, Mark ready) and back (a recall), with the ticket's button
 * busy until the server answers, a polite announcement when it's done and a toast when it isn't.
 * A step forward offers Undo for a few seconds (and `undoLast` for the keyboard's Backspace).
 * Items ticked off as plated are saved on the order, so every kitchen screen shows them.
 */
export function useTicketActions() {
  const t = useContent('kitchen');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const whereOf = useTicketWhere();
  // `mutateAsync` is stable, so `step` (passed to every ticket) is too; its promise settles per
  // call, so two tickets bumped at once each get their answer.
  const { mutateAsync } = useSetKitchenStatus();
  const { mutate: setPlated } = useSetPlated();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState('');
  // The last step forward, to take back (Undo, Backspace).
  const last = useRef<{ ticket: KitchenTicket; back: KitchenStep } | null>(null);

  const step = useCallback(
    (ticket: KitchenTicket, next: KitchenStep, back = false) => {
      // Its own function, so Undo (in the toast) can send the step back the same way.
      function run(ticket: KitchenTicket, next: KitchenStep, back: boolean) {
        setPending((keys) => new Set(keys).add(ticket.key));
        mutateAsync({
          branchId: branch.id,
          orderId: ticket.orderId,
          round: ticket.round,
          step: next,
          back,
        })
          .then(() => {
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
          })
          .catch(() => showToast(t('failed'), { tone: 'error' }))
          .finally(() =>
            setPending((keys) => {
              const rest = new Set(keys);
              rest.delete(ticket.key);
              return rest;
            }),
          );
      }
      run(ticket, next, back);
    },
    [branch.id, mutateAsync, showToast, t, whereOf],
  );

  /** Takes back the last step forward (Backspace); nothing once it's been undone. */
  const undoLast = useCallback(() => {
    const undo = last.current;
    if (undo) step(undo.ticket, undo.back, true);
  }, [step]);

  const togglePlated = useCallback(
    (ticket: KitchenTicket, index: number) => {
      setPlated(
        {
          branchId: branch.id,
          orderId: ticket.orderId,
          round: ticket.round,
          index,
          plated: ticket.items[index]?.plated !== true,
        },
        { onError: () => showToast(t('ticket.platedFailed'), { tone: 'error' }) },
      );
    },
    [branch.id, setPlated, showToast, t],
  );

  return { step, undoLast, pending, togglePlated, announcement, setAnnouncement };
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
