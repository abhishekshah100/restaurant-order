'use client';

import { useContent } from '@/api/hooks';
import { Button, Dialog, Icon } from '@/components/ui';
import { dueOn } from '@/lib/adminOrders';
import { ledgerOf, refundable } from '@/lib/adminPayments';
import { tablePath } from '@/lib/adminNav';
import type { Order } from '@/types/order';
import { OrderSummary } from '../orders/OrderSummary';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { methodIcon, usePaymentText } from './usePaymentText';
import styles from './PaymentDialogs.module.css';

/**
 * One order from the Payments page: everything on it (items, bill, status), every payment and
 * refund on it with when, how and who, and what can be done — Collect what's due, Refund what
 * was paid, Print the receipt, or open its table.
 */
export function PaymentOrderDialog({
  order,
  onClose,
  onCollect,
  onRefund,
  onPrint,
}: {
  order: Order | undefined;
  onClose: () => void;
  onCollect: (order: Order) => void;
  onRefund: (order: Order) => void;
  onPrint: (order: Order) => void;
}) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const { amount, methodName } = usePaymentText();
  if (!order) return null;
  const ledger = ledgerOf(order);
  const due = dueOn(order);
  const canRefund = refundable(order) > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={t('adminPayments.order.title', { order: order.id })}
      description={t('adminOrder.subtitle', {
        name: order.customerName,
        where:
          order.mode === 'dineIn' && order.table !== undefined
            ? t('adminHome.queue.where.table', { table: order.table })
            : t(`modes.${order.mode}`),
        time: clock.dateTime(order.placedAt),
      })}
      className={styles.dialog}
      footer={
        <div className={styles.orderActions}>
          {due > 0 && (
            <Button block iconStart="cash" meta={amount(due)} onClick={() => onCollect(order)}>
              {t('adminPayments.order.collect')}
            </Button>
          )}
          <div className={styles.orderSecondary}>
            <Button variant="secondary" iconStart="receipt" onClick={() => onPrint(order)}>
              {t('adminPayments.order.print')}
            </Button>
            {canRefund && (
              <Button variant="secondary" iconStart="refresh" onClick={() => onRefund(order)}>
                {t('adminPayments.order.refund')}
              </Button>
            )}
            {order.table !== undefined && (
              <Button variant="ghost" iconStart="table" href={tablePath(order.table)}>
                {t('adminPayments.order.table', { table: order.table })}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className={styles.form}>
        <section className={styles.block} aria-labelledby="order-payments">
          <h3 id="order-payments" className={styles.blockTitle}>
            {t('adminPayments.order.history')}
          </h3>
          {ledger.length > 0 ? (
            <ol className={styles.history}>
              {ledger.map((entry) => {
                const refund = entry.kind === 'refund';
                return (
                  <li key={entry.id} className={styles.historyItem} data-kind={entry.kind}>
                    <span className={styles.historyIcon} aria-hidden="true">
                      <Icon name={refund ? 'refresh' : methodIcon(entry.method)} size="xs" />
                    </span>
                    <span className={styles.historyBody}>
                      <span className={styles.historyTitle}>
                        {t(refund ? 'adminPayments.entry.refund' : 'adminPayments.entry.payment')}
                        {' · '}
                        {methodName(entry.method)}
                      </span>
                      <span className={styles.historyMeta}>
                        {[
                          clock.dateTime(entry.at),
                          entry.by && t('adminPayments.entry.by', { name: entry.by }),
                          entry.transactionRef &&
                            t('adminPayments.entry.ref', { ref: entry.transactionRef }),
                          entry.reason && t(`adminPayments.entry.reasons.${entry.reason}`),
                          refund &&
                            t(
                              entry.status === 'started'
                                ? 'adminPayments.entry.refundStarted'
                                : 'adminPayments.entry.refundDone',
                            ),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {entry.note && <span className={styles.historyNote}>{entry.note}</span>}
                    </span>
                    <span className={styles.historyAmount}>
                      {amount(refund ? -entry.amount : entry.amount)}
                      {entry.tip ? (
                        <small>{t('adminPayments.entry.tip', { amount: amount(entry.tip) })}</small>
                      ) : null}
                      {entry.waived && entry.waiveReason ? (
                        <small>
                          {t('adminPayments.entry.left', {
                            amount: amount(entry.waived),
                            reason: t(`adminPayments.entry.waiveReasons.${entry.waiveReason}`),
                          })}
                        </small>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={styles.note}>{t('adminPayments.order.none')}</p>
          )}
        </section>
        <OrderSummary order={order} />
      </div>
    </Dialog>
  );
}
