'use client';

import { useContent } from '@/api/hooks';
import { Dialog, StatusPill } from '@/components/ui';
import type { Money } from '@/lib/money';
import type { Order } from '@/types/order';
import { PaymentBadge } from './PaymentBadge';
import styles from './OrderDetailDialog.module.css';

/** An order's items, statuses and total, opened from a section's list. */
export function OrderDetailDialog({
  order,
  money,
  onClose,
}: {
  order: Order | undefined;
  money: Money;
  onClose: () => void;
}) {
  const t = useContent('common');
  const where = order
    ? order.mode === 'dineIn'
      ? t('adminDashboard.tableNumber', { table: order.table ?? '—' })
      : t(`modes.${order.mode}`)
    : '';
  return (
    <Dialog
      open={Boolean(order)}
      onClose={onClose}
      title={
        order
          ? t('adminDashboard.orderNumber', { order: order.id })
          : t('adminDashboard.orderDetails')
      }
      description={order ? `${order.customerName} · ${where}` : undefined}
    >
      {order && (
        <div className={styles.orderDetail}>
          <div className={styles.detailStatuses}>
            <StatusPill status={order.status} />
            <PaymentBadge status={order.payment.status}>
              {t('adminDashboard.payment')}:{' '}
              {t(`adminDashboard.paymentStatus.${order.payment.status}`)}
            </PaymentBadge>
          </div>
          <h3>{t('adminDashboard.items')}</h3>
          {order.items.map((item, index) => (
            <div className={styles.detailItem} key={`${item.dishSlug}-${index}`}>
              <div>
                <strong>
                  {item.quantity} × {item.name}
                </strong>
                <small>
                  {[item.variant, ...item.details].filter(Boolean).join(' · ') ||
                    t('adminDashboard.noModifiers')}
                </small>
                {item.note && <small>{t('adminDashboard.itemNote', { note: item.note })}</small>}
              </div>
              {item.status && <span className={styles.itemStatus}>{item.status}</span>}
            </div>
          ))}
          {order.kitchenNote && (
            <p className={styles.kitchenNote}>
              {t('adminDashboard.kitchenNote', { note: order.kitchenNote })}
            </p>
          )}
          <div className={styles.totalLine}>
            <span>{t('adminDashboard.orderTotal')}</span>
            <strong>{money.format(order.total)}</strong>
          </div>
        </div>
      )}
    </Dialog>
  );
}
