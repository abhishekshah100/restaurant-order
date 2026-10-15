import { useContent } from '@/api/hooks';
import { Button, Icon } from '@/components/ui';
import { dueOn } from '@/lib/adminOrders';
import type { DueGroup } from '@/lib/adminPayments';
import { cx } from '@/lib/cx';
import { WhereBadge } from '../home/WhereBadge';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { usePaymentText } from './usePaymentText';
import styles from './DueCard.module.css';

/**
 * One bill still open: a table (its orders with what's due on each) or a takeaway or delivery
 * order. A table whose guests asked for the bill says so first. What's due, anything paid so
 * far, and Print bill / Collect.
 */
export function DueCard({
  group,
  now,
  onCollect,
  onPrint,
  onOpenOrder,
}: {
  group: DueGroup;
  now: Date | null;
  onCollect: () => void;
  onPrint: () => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const { amount, ago } = usePaymentText();
  const request = group.kind === 'table' ? group.request : undefined;
  const orders = group.kind === 'table' ? group.orders : [group.order];
  const first = orders[0];
  const titleId = `due-${group.key}`;

  let title: string;
  let meta: string;
  if (group.kind === 'table') {
    title = t('adminPayments.due.table', { table: group.table });
    meta = `${t.plural('adminPayments.due.orders', orders.length)} · ${t('adminPayments.due.since', { time: clock.time(group.since) })}`;
  } else {
    const { order } = group;
    title = t('adminPayments.collect.orderLine', { order: order.id, name: order.customerName });
    meta = order.pickup
      ? order.pickup.asap
        ? t('adminPayments.due.pickupAsap')
        : t('adminPayments.due.pickup', { time: clock.time(order.pickup.at) })
      : order.delivery
        ? t('adminPayments.due.delivery', { area: order.delivery.address.area })
        : t('adminPayments.due.since', { time: clock.time(order.placedAt) });
  }

  return (
    <li className={cx(styles.card, request && styles.asked)} aria-labelledby={titleId}>
      {request && (
        <p className={styles.request}>
          <Icon name="bell" size="xs" />
          {now &&
            (request.acknowledgedBy
              ? t('adminPayments.due.askedOnWay', {
                  ago: ago(request.requestedAt, now),
                  name: request.acknowledgedBy,
                })
              : t('adminPayments.due.asked', { ago: ago(request.requestedAt, now) }))}
        </p>
      )}
      <div className={styles.head}>
        <WhereBadge table={group.kind === 'table' ? group.table : undefined} mode={first.mode} />
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.title}>
            {title}
          </h3>
          <p className={styles.meta}>{meta}</p>
        </div>
      </div>

      {group.kind === 'table' && (
        <ul className={styles.orders}>
          {orders.map((order) => (
            <li key={order.id}>
              <button type="button" className={styles.order} onClick={() => onOpenOrder(order.id)}>
                <span className={styles.orderName}>
                  {t('adminPayments.collect.orderLine', {
                    order: order.id,
                    name: order.customerName,
                  })}
                </span>
                <span className={styles.orderTime}>{clock.time(order.placedAt)}</span>
                <span className={styles.orderDue}>{amount(dueOn(order))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.foot}>
        <div className={styles.amount}>
          <span className={styles.amountLabel}>{t('adminPayments.due.dueLabel')}</span>
          <strong className={styles.amountValue}>{amount(group.due)}</strong>
          {group.paid > 0 && (
            <span className={styles.paid}>
              {t('adminPayments.due.partPaid', { amount: amount(group.paid) })}
            </span>
          )}
        </div>
        <div className={styles.actions}>
          {group.kind === 'order' && (
            <Button
              variant="ghost"
              size="sm"
              iconStart="eye"
              onClick={() => onOpenOrder(group.order.id)}
            >
              {t('adminPayments.due.view')}
            </Button>
          )}
          <Button variant="secondary" size="sm" iconStart="receipt" onClick={onPrint}>
            {t('adminPayments.due.printBill')}
          </Button>
          <Button size="sm" iconStart="cash" onClick={onCollect}>
            {t('adminPayments.due.collect')}
          </Button>
        </div>
      </div>
    </li>
  );
}
