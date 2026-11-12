import { useCallback } from 'react';
import type { HistoryTransaction, PaymentHistoryQuery } from '@/api/contracts';
import { api } from '@/api/endpoints';
import { useAdminToken } from '@/hooks/useAdminSession';
import type { LedgerLine } from '@/lib/adminPayments';
import type { WaiveReason } from '@/types/order';

/** A transaction from the server's money list, as the rows show it (the order's number, guest…). */
export const toLine = (tx: HistoryTransaction): LedgerLine => ({
  id: tx.id,
  kind: tx.kind,
  amount: tx.amount,
  channel: tx.channel,
  method: tx.method,
  at: tx.at,
  ...(tx.by ? { by: tx.by } : {}),
  ...(tx.transactionRef ? { transactionRef: tx.transactionRef } : {}),
  ...(tx.tip ? { tip: tx.tip } : {}),
  ...(tx.waived ? { waived: tx.waived } : {}),
  ...(tx.waiveReason ? { waiveReason: tx.waiveReason as WaiveReason } : {}),
  ...(tx.reason ? { reason: tx.reason as LedgerLine['reason'] } : {}),
  ...(tx.note ? { note: tx.note } : {}),
  ...(tx.status ? { status: tx.status } : {}),
  order: {
    id: tx.orderId,
    customerName: tx.customerName,
    mode: tx.mode,
    ...(tx.table !== undefined ? { table: tx.table } : {}),
  },
});

/**
 * Every payment and refund matching a query, a thousand at a time (for the Excel file and the
 * day report). Throws when the server can't be reached; nothing without a sign-in.
 */
export function useAllPayments() {
  const token = useAdminToken();
  return useCallback(
    async (
      branchId: string,
      query: Omit<PaymentHistoryQuery, 'cursor' | 'limit'>,
    ): Promise<LedgerLine[]> => {
      if (!token) return [];
      const all: HistoryTransaction[] = [];
      let cursor: string | undefined;
      do {
        const page = await api.paymentHistory(token, branchId, {
          ...query,
          limit: 1000,
          ...(cursor ? { cursor } : {}),
        });
        all.push(...page.transactions);
        cursor = page.next;
      } while (cursor);
      return all.map(toLine);
    },
    [token],
  );
}
