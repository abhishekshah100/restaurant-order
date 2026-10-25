'use client';

import { useState } from 'react';
import { useBranchOrders, useContent } from '@/api/hooks';
import { Button, Dialog, Icon, StatusPill } from '@/components/ui';
import { dueOn } from '@/lib/adminOrders';
import { isTodayOnly, type DayRange } from '@/lib/dayRange';
import { isFinished } from '@/lib/orders';
import type { Order } from '@/types/order';
import { DateRangeFilter } from '../DateRangeFilter';
import { OrderSummary } from '../orders/OrderSummary';
import { PaymentBadge } from '../orders/PaymentBadge';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './TableHistoryDialog.module.css';

/** Done with: cancelled, or served and nothing left to pay. */
const isCompleted = (order: Order) =>
  order.status === 'cancelled' || (isFinished(order) && dueOn(order) <= 0);

/**
 * A table's order history: its completed and cancelled orders over the days picked (today to
 * start with, up to 90 days back), newest first, read from GET /admin/branches/:branchId/orders
 * ?from=&to=&table=. An order opens with everything on it, with Back to the list.
 */
export function TableHistoryDialog({ table, onClose }: { table: number; onClose: () => void }) {
  const t = useContent('common');
  const { branch, clock, money } = useAdminWorkspace();
  const today = clock.dayKey(new Date());
  const [days, setDays] = useState<DayRange>({ from: today, to: today });
  const [openId, setOpenId] = useState<string | null>(null);
  const orders = useBranchOrders(branch.id, { ...days, table }, days.to === today);
  const completed = (orders.data?.orders ?? []).filter(isCompleted);
  const open = openId ? completed.find((o) => o.id === openId) : undefined;
  const oneDay = isTodayOnly(days, today) || days.from === days.to;

  let body;
  if (open) {
    body = <OrderSummary order={open} />;
  } else if (orders.data) {
    body =
      completed.length > 0 ? (
        <ul className={styles.list}>
          {completed.map((order) => (
            <li key={order.id}>
              <button type="button" className={styles.row} onClick={() => setOpenId(order.id)}>
                <span className={styles.main}>
                  <span className={styles.name}>
                    {t('adminTables.detail.history.row', {
                      order: order.id,
                      name: order.customerName,
                    })}
                  </span>
                  <span className={styles.meta}>
                    {oneDay
                      ? clock.time(order.placedAt)
                      : t('adminTables.detail.history.when', {
                          date: clock.date(order.placedAt),
                          time: clock.time(order.placedAt),
                        })}
                    {' · '}
                    {t.plural(
                      'adminTables.detail.history.items',
                      order.items.reduce((n, item) => n + item.quantity, 0),
                    )}
                  </span>
                </span>
                <span className={styles.side}>
                  <span className={styles.total}>{money.format(order.total)}</span>
                  {order.status === 'cancelled' ? (
                    <StatusPill status={order.status} />
                  ) : (
                    <PaymentBadge status={order.payment.status}>
                      {t(`adminDashboard.paymentStatus.${order.payment.status}`)}
                    </PaymentBadge>
                  )}
                </span>
                <Icon name="chev" size="sm" className={styles.chevron} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{t('adminTables.detail.history.empty')}</p>
      );
  } else if (orders.isError) {
    body = (
      <div className={styles.empty}>
        <p>{t('adminTables.detail.history.failed')}</p>
        <Button
          variant="secondary"
          size="sm"
          iconStart="refresh"
          loading={orders.isFetching}
          onClick={() => orders.refetch()}
        >
          {t('adminTables.detail.history.retry')}
        </Button>
      </div>
    );
  } else {
    body = (
      <div
        className={styles.loading}
        role="status"
        aria-label={t('adminTables.detail.history.loading')}
      />
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      presentation="adaptive"
      title={
        open
          ? t('adminOrder.title', { order: open.id })
          : t('adminTables.detail.history.title', { table })
      }
      description={open ? undefined : t('adminTables.detail.history.subtitle')}
      footer={
        open ? (
          <Button variant="secondary" iconStart="back" onClick={() => setOpenId(null)}>
            {t('adminTables.detail.history.back')}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.body}>
        {!open && (
          <DateRangeFilter
            id={`table-${table}-history`}
            range={days}
            today={today}
            onChange={setDays}
          />
        )}
        {body}
      </div>
    </Dialog>
  );
}
