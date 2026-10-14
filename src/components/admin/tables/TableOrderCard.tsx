import { useContent } from '@/api/hooks';
import { Icon, StatusPill } from '@/components/ui';
import type { Order } from '@/types/order';
import { PaymentBadge } from '../sections/PaymentBadge';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './TableOrderCard.module.css';

/** Dishes named on the card before "+2 more". */
const PREVIEW_ITEMS = 2;

/**
 * One open order at the table: its number and kitchen status, who ordered and when, the first
 * dishes, and its total with the payment state. Opens the order's details.
 */
export function TableOrderCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const t = useContent('common');
  const { money, clock } = useAdminWorkspace();
  const shown = order.items.slice(0, PREVIEW_ITEMS);
  const hidden = order.items.length - shown.length;
  const itemCount = order.items.reduce((n, item) => n + item.quantity, 0);

  return (
    <button
      type="button"
      className={styles.card}
      onClick={onOpen}
      aria-label={t('adminTables.detail.order.open', { order: order.id })}
    >
      <span className={styles.head}>
        <span className={styles.id}>
          {t('adminTables.detail.order.title', { order: order.id })}
        </span>
        <StatusPill status={order.status} />
      </span>
      <span className={styles.placed}>
        {t('adminTables.detail.order.placed', {
          name: order.customerName,
          time: clock.time(order.placedAt),
        })}
      </span>
      <span className={styles.items}>
        {shown.map((item) => `${item.quantity} × ${item.name}`).join(', ')}
        {hidden > 0 && (
          <span className={styles.more}>{t.plural('adminTables.detail.order.more', hidden)}</span>
        )}
      </span>
      <span className={styles.foot}>
        <span className={styles.count}>{t.plural('adminOrder.itemCount', itemCount)}</span>
        <PaymentBadge status={order.payment.status}>
          {t(`adminDashboard.paymentStatus.${order.payment.status}`)}
        </PaymentBadge>
        <strong className={styles.total}>{money.format(order.total)}</strong>
        <Icon name="chev" size="xs" className={styles.chev} />
      </span>
    </button>
  );
}
