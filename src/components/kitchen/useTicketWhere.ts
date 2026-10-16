'use client';

import { useCallback } from 'react';
import { useContent } from '@/api/hooks';
import type { KitchenTicket } from '@/lib/kitchenBoard';

/** Where a ticket goes, in words: "Table 5", "Pickup" or "Delivery". */
export function useTicketWhere() {
  const t = useContent('kitchen');
  return useCallback(
    (ticket: Pick<KitchenTicket, 'table' | 'mode'>) =>
      ticket.table !== undefined
        ? t('ticket.where.table', { table: ticket.table })
        : t(ticket.mode === 'delivery' ? 'ticket.where.delivery' : 'ticket.where.pickup'),
    [t],
  );
}
