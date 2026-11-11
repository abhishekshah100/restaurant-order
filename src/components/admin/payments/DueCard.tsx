import { useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Icon, IconButton } from '@/components/ui';
import { dueOn } from '@/lib/adminOrders';
import type { DueGroup } from '@/lib/adminPayments';
import { cx } from '@/lib/cx';
import { WhereBadge } from '../home/WhereBadge';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { usePaymentText } from './usePaymentText';
import styles from './DueCard.module.css';

/**
 * One bill still open, as one compact row: where, whose and how long, what's due, then Print
 * bill (icon) and Collect. Tapping the row opens the order; a table with several orders opens
 * its list instead (each order opens). A table that asked for the bill says so in gold; a bill
 * from an earlier day shows its date, not "170 h ago". (The badge says where: table, pickup.)
 */
export function DueCard({
  group,
  now,
  earlier = false,
  onCollect,
  onPrint,
  onOpenOrder,
}: {
  group: DueGroup;
  now: Date | null;
  /** Opened on an earlier day. */
  earlier?: boolean;
  onCollect: () => void;
  onPrint: () => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const t = useContent('common');
  const { clock, can } = useAdminWorkspace();
  const { amount, ago } = usePaymentText();
  const [expanded, setExpanded] = useState(false);
  const request = group.kind === 'table' ? group.request : undefined;
  const orders = group.kind === 'table' ? group.orders : [group.order];
  const first = orders[0];
  const several = orders.length > 1;
  const listId = `due-orders-${group.key}`;

  const title =
    group.kind === 'table'
      ? several
        ? t('adminPayments.due.table', { table: group.table })
        : t('adminPayments.collect.orderLine', { order: first.id, name: first.customerName })
      : t('adminPayments.collect.orderLine', {
          order: group.order.id,
          name: group.order.customerName,
        });

  // How long it's been open: the time for an earlier day, else "12 min ago".
  const age = earlier ? clock.date(group.since) : now ? ago(group.since, now) : '';
  let kind = '';
  if (group.kind === 'table') {
    if (several) kind = t.plural('adminPayments.due.orders', orders.length);
  } else {
    const { order } = group;
    if (order.pickup && !order.pickup.asap) {
      kind = t('adminPayments.due.pickup', { time: clock.dateTime(order.pickup.at) });
    } else if (order.delivery) {
      kind = t('adminPayments.due.delivery', { area: order.delivery.address.area });
    }
  }
  const meta = request
    ? now
      ? request.acknowledgedBy
        ? t('adminPayments.due.askedOnWay', {
            ago: ago(request.requestedAt, now),
            name: request.acknowledgedBy,
          })
        : t('adminPayments.due.asked', { ago: ago(request.requestedAt, now) })
      : ''
    : [kind, age].filter(Boolean).join(' · ');

  return (
    <li className={cx(styles.row, request && styles.asked, earlier && !request && styles.earlier)}>
      <button
        type="button"
        className={styles.main}
        aria-expanded={several ? expanded : undefined}
        aria-controls={several ? listId : undefined}
        onClick={() => (several ? setExpanded((open) => !open) : onOpenOrder(first.id))}
      >
        <WhereBadge table={first.table} mode={first.mode} />
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          <span className={styles.meta}>
            {request && <Icon name="bell" size="xs" />}
            {meta}
            {several && (
              <Icon name="chevd" size="xs" className={cx(styles.chevron, expanded && styles.up)} />
            )}
          </span>
        </span>
      </button>

      <span className={styles.amount}>
        <strong className={styles.due}>{amount(group.due)}</strong>
        {group.paid > 0 && (
          <span className={styles.paid}>
            {t('adminPayments.due.partPaid', { amount: amount(group.paid) })}
          </span>
        )}
      </span>

      <span className={styles.actions}>
        <IconButton
          icon="receipt"
          label={t('adminPayments.due.printBill')}
          className={styles.print}
          onClick={onPrint}
        />
        {can('payments.collect') && (
          <Button size="sm" iconStart="cash" className={styles.collect} onClick={onCollect}>
            {t('adminPayments.due.collect')}
          </Button>
        )}
      </span>

      {several && expanded && (
        <ul id={listId} className={styles.orders}>
          {orders.map((order) => (
            <li key={order.id}>
              <button type="button" className={styles.order} onClick={() => onOpenOrder(order.id)}>
                <span className={styles.orderName}>
                  {t('adminPayments.collect.orderLine', {
                    order: order.id,
                    name: order.customerName,
                  })}
                </span>
                <span className={styles.orderTime}>{clock.dateTime(order.placedAt)}</span>
                <span className={styles.orderDue}>{amount(dueOn(order))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
