import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import type { LedgerEntry } from '@/lib/adminPayments';
import { cx } from '@/lib/cx';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { methodIcon, usePaymentText } from './usePaymentText';
import styles from './LedgerRow.module.css';

/**
 * One payment or refund: the method, the order and where, when and who took it (or why it was
 * refunded), the reference, any tip, and the amount (a refund in red, with whether it has
 * reached the guest). Opens the order.
 */
export function LedgerRow({ entry, onOpen }: { entry: LedgerEntry; onOpen: () => void }) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const { amount, methodName, where } = usePaymentText();
  const refund = entry.kind === 'refund';
  const kind = t(refund ? 'adminPayments.entry.refund' : 'adminPayments.entry.payment');
  const details = [
    clock.time(entry.at),
    t(entry.channel === 'online' ? 'adminPayments.entry.online' : 'adminPayments.entry.inPerson'),
    entry.by && t('adminPayments.entry.by', { name: entry.by }),
    entry.transactionRef && t('adminPayments.entry.ref', { ref: entry.transactionRef }),
  ].filter(Boolean);

  return (
    <li>
      <button
        type="button"
        className={cx(styles.row, refund && styles.refund)}
        aria-label={t('adminPayments.entry.open', {
          kind,
          amount: amount(entry.amount),
          order: entry.order.id,
        })}
        onClick={onOpen}
      >
        <span className={styles.icon} data-channel={entry.channel} aria-hidden="true">
          <Icon name={refund ? 'refresh' : methodIcon(entry.method)} size="sm" />
        </span>
        <span className={styles.body}>
          <span className={styles.title}>
            <span className={styles.method}>{methodName(entry.method)}</span>
            <span className={styles.where}>
              {t('adminPayments.entry.where', { order: entry.order.id, where: where(entry.order) })}
              {' · '}
              {entry.order.customerName}
            </span>
          </span>
          <span className={styles.meta}>{details.join(' · ')}</span>
          {(entry.reason || entry.note) && (
            <span className={styles.reason}>
              {entry.reason && t(`adminPayments.entry.reasons.${entry.reason}`)}
              {entry.reason && entry.note && ' — '}
              {entry.note}
            </span>
          )}
        </span>
        <span className={styles.end}>
          <span className={styles.amount}>
            {refund ? amount(-entry.amount) : amount(entry.amount)}
          </span>
          {entry.tip ? (
            <span className={styles.tip}>
              {t('adminPayments.entry.tip', { amount: amount(entry.tip) })}
            </span>
          ) : null}
          {refund && (
            <span className={styles.status} data-status={entry.status}>
              {t(
                entry.status === 'started'
                  ? 'adminPayments.entry.refundStarted'
                  : 'adminPayments.entry.refundDone',
              )}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
