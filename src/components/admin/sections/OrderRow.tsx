import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import type { Money } from '@/lib/money';
import type { Order } from '@/types/order';
import styles from './OrderRow.module.css';

/** One order in a section's list; opens its details. */
export function OrderRow({
  order,
  money,
  onClick,
}: {
  order: Order;
  money: Money;
  onClick: () => void;
}) {
  const t = useContent('common');
  const event = order.timeline.at(-1);
  const where =
    order.mode === 'dineIn'
      ? t('adminDashboard.tableNumber', { table: order.table ?? '—' })
      : t(`modes.${order.mode}`);
  return (
    <button type="button" className={styles.orderRow} onClick={onClick}>
      <span className={styles.orderIcon}>
        <Icon name={order.mode === 'dineIn' ? 'table' : 'bag'} size="sm" />
      </span>
      <span className={styles.orderCopy}>
        <strong>
          {order.customerName} <small>· {where}</small>
        </strong>
        <span>
          {t('adminDashboard.itemCount', { count: order.items.length })} <i>·</i>{' '}
          {event?.time ??
            new Date(order.placedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </span>
      <span className={styles.orderAmount}>
        {money.format(order.total)}
        <small>{t(`orderStatus.${order.status}`)}</small>
      </span>
      <Icon name="chev" size="xs" />
    </button>
  );
}
