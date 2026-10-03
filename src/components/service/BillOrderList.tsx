import { useContent } from '@/api/hooks';
import { Tag } from '@/components/ui';
import { cx } from '@/lib/cx';
import { formatINR, formatTime } from '@/lib/format';
import { isOwnOrder } from '@/lib/orders';
import { isPaid } from '@/lib/service';
import type { Order } from '@/types/order';
import styles from './BillOrderList.module.css';

/** The orders on the bill: stacked rows on mobile (20), a four-column table on web (w20). */
export function BillOrderList({
  orders,
  sessionId,
}: {
  orders: Order[];
  /** This guest's session: their orders read "You". */
  sessionId: string | undefined;
}) {
  const t = useContent('service');
  const who = (order: Order) =>
    isOwnOrder(order, sessionId) ? t('billOrders.you') : order.customerName;
  return (
    <div className={styles.wrap}>
      <div className={cx(styles.cols, 't-caption c3')} aria-hidden="true">
        <span>{t('billOrders.columns.order')}</span>
        <span>{t('billOrders.columns.placedBy')}</span>
        <span className={styles.end}>{t('billOrders.columns.amount')}</span>
        <span className={styles.end}>{t('billOrders.columns.status')}</span>
      </div>
      <ul className={styles.list}>
        {orders.map((order) => {
          const time = formatTime(order.placedAt);
          return (
            <li key={order.id} className={styles.row}>
              <b className={styles.id}>
                {t('billOrders.orderRef', { id: order.id })}
                <span className="hide-desktop"> · {who(order)}</span>
              </b>
              <span className={styles.by}>
                <span className="hide-mobile">{who(order)} · </span>
                {time}
              </span>
              <b className={styles.amount}>{formatINR(order.total)}</b>
              <span className={styles.status}>
                {isPaid(order) ? (
                  <Tag variant="ok" icon={null}>
                    {t('billOrders.paid')}
                  </Tag>
                ) : (
                  <Tag variant="warn" icon={null}>
                    {t('billOrders.unpaid')}
                  </Tag>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
