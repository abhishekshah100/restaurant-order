'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useContent } from '@/api/hooks';
import type { KitchenStep } from '@/api/contracts';
import { useSetKitchenStatus } from '@/api/mutations';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { useToast } from '@/context/ToastContext';
import type { KitchenTicket } from '@/lib/kitchenBoard';
import { useTicketWhere } from '../useTicketWhere';

/**
 * Moving tickets on (Start cooking, Mark ready) with the ticket's button busy until the server
 * answers, a polite announcement when it's done and a toast when it isn't; and what's been
 * plated on each ticket (this screen only: a cook's own tick list, not sent anywhere).
 */
export function useTicketActions() {
  const t = useContent('kitchen');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  // `mutateAsync` is stable, so `step` (passed to every ticket) is too; its promise settles per
  // call, so two tickets bumped at once each get their answer.
  const { mutateAsync } = useSetKitchenStatus();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [plated, setPlated] = useState<ReadonlyMap<string, ReadonlySet<number>>>(new Map());
  const [announcement, setAnnouncement] = useState('');

  const step = useCallback(
    (ticket: KitchenTicket, next: KitchenStep) => {
      setPending((keys) => new Set(keys).add(ticket.key));
      mutateAsync({ branchId: branch.id, orderId: ticket.orderId, round: ticket.round, step: next })
        .then(() => setAnnouncement(t(`board.announce.${next}`, { order: ticket.orderId })))
        .catch(() => showToast(t('failed'), { tone: 'error' }))
        .finally(() =>
          setPending((keys) => {
            const rest = new Set(keys);
            rest.delete(ticket.key);
            return rest;
          }),
        );
    },
    [branch.id, mutateAsync, showToast, t],
  );

  const togglePlated = useCallback((key: string, index: number) => {
    setPlated((all) => {
      const items = new Set(all.get(key));
      if (items.has(index)) items.delete(index);
      else items.add(index);
      return new Map(all).set(key, items);
    });
  }, []);

  return { step, pending, plated, togglePlated, announcement, setAnnouncement };
}

/**
 * Says when new tickets come in (after the first read, so opening the board doesn't read them
 * all out): one by name, several by count.
 */
export function useArrivals(
  tickets: readonly KitchenTicket[] | undefined,
  announce: (message: string) => void,
) {
  const t = useContent('kitchen');
  const whereOf = useTicketWhere();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!tickets) return;
    const fresh = tickets.filter((ticket) => ticket.stage === 'new');
    if (seen.current) {
      const arrived = fresh.filter((ticket) => !seen.current?.has(ticket.key));
      if (arrived.length === 1) {
        const [ticket] = arrived;
        announce(
          t.plural('board.announce.new', 1, { where: whereOf(ticket), order: ticket.orderId }),
        );
      } else if (arrived.length > 1) {
        announce(t.plural('board.announce.new', arrived.length));
      }
    }
    seen.current = new Set([...(seen.current ?? []), ...fresh.map((ticket) => ticket.key)]);
  }, [announce, t, tickets, whereOf]);
}
