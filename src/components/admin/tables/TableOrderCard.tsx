import { useContent } from '@/api/hooks';
import { Icon, StatusPill } from '@/components/ui';
import { dueOn } from '@/lib/adminOrders';
import { cx } from '@/lib/cx';
import type { Order } from '@/types/order';
import { PaymentBadge } from '../orders/PaymentBadge';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './TableOrderCard.module.css';

/** Dishes named on the card before "+2 more". */
const PREVIEW_ITEMS = 2;

/**
 * One open order at the table: its number and kitchen status, who ordered and when, the first
 * dishes, and its total with the payment state. The card opens the order's details. Its actions:
 * Add items (a new round), Change (the round the kitchen hasn't finished, if any) and Collect
 * (while something is due — before, during or after the meal).
 */
export function TableOrderCard({
  order,
  onOpen,
  onAddItems,
  onChange,
  onCollect,
}: {
  order: Order;
  onOpen: () => void;
  onAddItems: () => void;
  /** Present while a round can still be changed. */
  onChange?: () => void;
  onCollect: () => void;
}) {
  const t = useContent('common');
  const { money, clock } = useAdminWorkspace();
  const shown = order.items.slice(0, PREVIEW_ITEMS);
  const hidden = order.items.length - shown.length;
  const itemCount = order.items.reduce((n, item) => n + item.quantity, 0);
  const due = dueOn(order);

  return (
    <article className={styles.card}>
      <span className={styles.head}>
        {/* Covers the card (see .open::after), so a tap anywhere opens the details. */}
        <button
          type="button"
          className={styles.open}
          onClick={onOpen}
          aria-label={t('adminTables.detail.order.open', { order: order.id })}
        >
          {t('adminTables.detail.order.title', { order: order.id })}
          {order.token !== undefined && (
            <span className={styles.token}>{t('adminOrder.token', { token: order.token })}</span>
          )}
        </button>
        <StatusPill status={order.status} />
      </span>
      <span className={styles.placed}>
        {t('adminTables.detail.order.placed', {
          name: order.customerName,
          time: clock.dateTime(order.placedAt),
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
      </span>
      <span className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          onClick={onAddItems}
          aria-label={t('adminTables.detail.order.addItemsLabel', { order: order.id })}
        >
          <Icon name="plus" size="xs" />
          {t('adminTables.detail.order.addItems')}
        </button>
        {onChange && (
          <button
            type="button"
            className={styles.action}
            onClick={onChange}
            aria-label={t('adminTables.detail.order.changeLabel', { order: order.id })}
          >
            <Icon name="pencil" size="xs" />
            {t('adminTables.detail.order.change')}
          </button>
        )}
        {due > 0 && (
          <button
            type="button"
            className={cx(styles.action, styles.collect)}
            onClick={onCollect}
            aria-label={t('adminTables.detail.order.collectLabel', { order: order.id })}
          >
            <Icon name="cash" size="xs" />
            {t('adminTables.detail.order.collect')}
          </button>
        )}
      </span>
    </article>
  );
}
