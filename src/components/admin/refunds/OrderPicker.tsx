'use client';

import { useState } from 'react';
import { useBranchOrders, useContent } from '@/api/hooks';
import { Button, Dialog, Icon, SearchField } from '@/components/ui';
import { refundable } from '@/lib/adminPayments';
import { shiftDay } from '@/lib/dayRange';
import { paidAmount } from '@/lib/lifecycle';
import { isFinished } from '@/lib/orders';
import type { Order } from '@/types/order';
import { WhereBadge } from '../home/WhereBadge';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './RefundsPage.module.css';

/** How far back a refund can be picked from. */
const REFUND_DAYS = 30;

/**
 * Pick the order to refund (paid orders from the last 30 days with money left to give back) or
 * to cancel (today's orders that aren't finished), newest first, found by number, guest or
 * table. The refund or cancel window that opens next is the one Orders and Payments use. A line
 * under the list says why an order may not be there (and, for cancelling, offers a refund).
 */
export function OrderPicker({
  kind,
  today,
  onPick,
  onClose,
  onSwitchToRefund,
}: {
  kind: 'refund' | 'cancel';
  today: string;
  onPick: (order: Order) => void;
  onClose: () => void;
  /** Cancelling: open Refund an order instead (paid orders can't be cancelled). */
  onSwitchToRefund?: () => void;
}) {
  const t = useContent('common');
  const { branch, clock, money } = useAdminWorkspace();
  const [query, setQuery] = useState('');
  const range =
    kind === 'refund' ? { from: shiftDay(today, -(REFUND_DAYS - 1)), to: today } : undefined;
  const orders = useBranchOrders(branch.id, range ?? {}, kind === 'cancel');
  const all = orders.data?.orders ?? [];
  const candidates = all
    .filter((o) =>
      kind === 'refund' ? refundable(o) > 0 : o.status !== 'cancelled' && !isFinished(o),
    )
    .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));
  const q = query.trim().toLowerCase();
  const shown = q
    ? candidates.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          (o.table !== undefined && String(o.table) === q),
      )
    : candidates;

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t(
        kind === 'refund' ? 'adminRefunds.picker.refundTitle' : 'adminRefunds.picker.cancelTitle',
      )}
      description={t(
        kind === 'refund' ? 'adminRefunds.picker.refundBody' : 'adminRefunds.picker.cancelBody',
      )}
      className={styles.pickerDialog}
    >
      <div className={styles.picker}>
        <SearchField
          value={query}
          onChange={setQuery}
          label={t('adminRefunds.picker.search')}
          placeholder={t('adminRefunds.picker.search')}
        />
        {!orders.data ? (
          <p className={styles.muted} aria-busy="true">
            {t('adminRefunds.picker.loading')}
          </p>
        ) : shown.length === 0 ? (
          <p className={styles.muted}>
            {q
              ? t('adminRefunds.picker.noMatch', { query: query.trim() })
              : t('adminRefunds.picker.none')}
          </p>
        ) : (
          <ul className={styles.pickList}>
            {shown.map((o) => (
              <li key={o.id}>
                <button type="button" className={styles.pick} onClick={() => onPick(o)}>
                  <WhereBadge table={o.table} mode={o.mode} />
                  <span className={styles.pickMain}>
                    <strong>
                      {t('adminPayments.collect.orderLine', { order: o.id, name: o.customerName })}
                    </strong>
                    <span className={styles.muted}>{clock.dateTime(o.placedAt)}</span>
                  </span>
                  <span className={styles.pickAmount}>
                    <strong>{money.format(o.total)}</strong>
                    {kind === 'refund' && (
                      <span className={styles.muted}>
                        {t('adminRefunds.picker.paid', { amount: money.format(paidAmount(o)) })}
                      </span>
                    )}
                  </span>
                  <Icon name="chev" size="xs" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {orders.data && (
          <div className={styles.pickHelp}>
            <p className={styles.muted}>
              <Icon name="info" size="xs" />
              {t(
                kind === 'refund'
                  ? 'adminRefunds.picker.refundHelp'
                  : 'adminRefunds.picker.cancelHelp',
              )}
            </p>
            {kind === 'cancel' && onSwitchToRefund && (
              <Button size="sm" variant="secondary" iconStart="refresh" onClick={onSwitchToRefund}>
                {t('adminRefunds.picker.switchToRefund')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
