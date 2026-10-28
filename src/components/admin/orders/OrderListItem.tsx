import { useContent } from '@/api/hooks';
import { Icon, StatusPill } from '@/components/ui';
import { minutesSince } from '@/lib/adminService';
import { nextAction, type OrderAction } from '@/lib/adminOrders';
import { isFinished } from '@/lib/orders';
import type { Order } from '@/types/order';
import { WhereBadge } from '../home/WhereBadge';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { PaymentBadge } from './PaymentBadge';
import styles from './OrderListItem.module.css';

/** Dishes named in a row before "+2". */
const PREVIEW_ITEMS = 2;

const ACTION_ICONS = { serve: 'check', handOver: 'bag', collect: 'cash' } as const;

/**
 * One order in the list: where it goes (table, pickup, delivery), its number and guest, the
 * first dishes, when it was placed (and how long ago while it's open), its kitchen and payment
 * state, its total, and the one action it needs next. The row opens the order.
 */
export function OrderListItem({
  order,
  now,
  onOpen,
  onAction,
}: {
  order: Order;
  now: Date | null;
  onOpen: () => void;
  onAction: (action: OrderAction) => void;
}) {
  const t = useContent('common');
  const { money, clock } = useAdminWorkspace();
  const action = nextAction(order);
  const shown = order.items.slice(0, PREVIEW_ITEMS);
  const hidden = order.items.length - shown.length;
  // How long it's been open; none once it's finished (or for a time still to come).
  const minutes =
    now && !isFinished(order) && Date.parse(order.placedAt) <= now.getTime()
      ? minutesSince(order.placedAt, now)
      : null;

  const when = [clock.dateTime(order.placedAt)];
  if (minutes !== null) {
    when.push(
      minutes < 1
        ? t('adminHome.queue.age.now')
        : t('adminHome.queue.age.minutes', { count: minutes }),
    );
  }
  if (order.mode === 'takeaway' && order.pickup) {
    when.push(t('adminOrders.row.pickupAt', { time: clock.dateTime(order.pickup.at) }));
  }
  if (order.mode === 'delivery' && order.delivery) {
    when.push(t('adminOrders.row.deliveryTo', { area: order.delivery.address.area }));
  }

  return (
    <li className={styles.row} data-cancelled={order.status === 'cancelled' || undefined}>
      <WhereBadge table={order.table} mode={order.mode} />

      <div className={styles.main}>
        {/* Covers the row (see .open::after), so a tap anywhere opens the order. */}
        <button
          type="button"
          className={styles.open}
          onClick={onOpen}
          aria-label={t('adminOrders.row.open', { order: order.id })}
        >
          <span className={styles.id}>
            {t('adminOrders.row.title', { order: order.id })}
            {order.token !== undefined && (
              <span className={styles.token}>{t('adminOrder.token', { token: order.token })}</span>
            )}
            {order.rush && <span className={styles.rush}>{t('adminOrder.rushBadge')}</span>}
          </span>
          <span className={styles.guest}>{order.customerName}</span>
        </button>
        <p className={styles.items}>
          {shown.map((item) => `${item.quantity} × ${item.name}`).join(', ')}
          {hidden > 0 && (
            <span className={styles.more}>{t('adminOrders.row.more', { count: hidden })}</span>
          )}
        </p>
        <p className={styles.when}>{when.join(' · ')}</p>
      </div>

      <div className={styles.state}>
        <StatusPill status={order.status} />
        <PaymentBadge status={order.payment.status}>
          {t(`adminDashboard.paymentStatus.${order.payment.status}`)}
        </PaymentBadge>
      </div>

      <strong className={styles.total}>{money.format(order.total)}</strong>

      <div className={styles.end}>
        {action ? (
          <button
            type="button"
            className={styles.action}
            data-action={action}
            onClick={() => onAction(action)}
            aria-label={t('adminOrders.actions.label', {
              action: t(`adminOrders.actions.${action}`),
              order: order.id,
            })}
          >
            <Icon name={ACTION_ICONS[action]} size="xs" />
            {t(`adminOrders.actions.${action}`)}
          </button>
        ) : (
          <Icon name="chev" size="xs" className={styles.chev} />
        )}
      </div>
    </li>
  );
}
