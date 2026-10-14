'use client';

import { useState } from 'react';
import { useBranchOrderHistory } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { OrderDetailDialog } from './OrderDetailDialog';
import { PaymentBadge } from './PaymentBadge';
import { DataBanner, ErrorNotice, SectionEmpty, SectionPage } from './SectionPage';
import styles from './PaymentsSection.module.css';

/** /admin/dashboard/payments/: each order's payment status (to be redesigned). */
export function PaymentsSection() {
  const t = useContent('common');
  const { region, money } = useAdminWorkspace();
  const { orders, error } = useBranchOrderHistory(region);
  const [selectedOrder, setSelectedOrder] = useState<Order>();

  return (
    <SectionPage
      title={t('adminShell.nav.payments')}
      subtitle={t('adminDashboard.sections.paymentsSubtitle')}
    >
      <DataBanner>{t('adminDashboard.paymentsDisclaimer')}</DataBanner>
      {error ? (
        <ErrorNotice>{error.message}</ErrorNotice>
      ) : orders.length ? (
        <div className={styles.paymentList}>
          {orders.map((order) => (
            <button
              type="button"
              key={order.id}
              className={styles.paymentRow}
              onClick={() => setSelectedOrder(order)}
            >
              <span className={styles.paymentIcon}>
                <Icon name="card" size="sm" />
              </span>
              <span>
                <strong>{t('adminDashboard.orderNumber', { order: order.id })}</strong>
                <small>
                  {order.customerName} · {order.payment.method}
                </small>
              </span>
              <strong>{money.format(order.total)}</strong>
              <PaymentBadge status={order.payment.status}>
                {t(`adminDashboard.paymentStatus.${order.payment.status}`)}
              </PaymentBadge>
            </button>
          ))}
        </div>
      ) : (
        <SectionEmpty label={t('adminDashboard.empty.noPayments')} />
      )}
      <OrderDetailDialog
        order={selectedOrder}
        money={money}
        onClose={() => setSelectedOrder(undefined)}
      />
    </SectionPage>
  );
}
