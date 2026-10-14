'use client';

import { useState } from 'react';
import { useBranchOrderHistory } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { OrderDetailDialog } from './OrderDetailDialog';
import { OrderRow } from './OrderRow';
import { ErrorNotice, SectionEmpty, SectionPage } from './SectionPage';
import styles from './OrdersSection.module.css';

export type OrderFilter = 'all' | 'ready' | 'unpaid';

const FILTERS: OrderFilter[] = ['all', 'ready', 'unpaid'];

const matches = (order: Order, filter: OrderFilter) => {
  if (filter === 'ready') return order.status === 'ready';
  if (filter === 'unpaid') return order.status !== 'cancelled' && order.payment.status === 'unpaid';
  return true;
};

/** /admin/dashboard/orders/ (and its ready/ and unpaid/ filters): the branch's orders. */
export function OrdersSection({ filter: initialFilter = 'all' }: { filter?: OrderFilter }) {
  const t = useContent('common');
  const { region, money } = useAdminWorkspace();
  const { orders, loading, error } = useBranchOrderHistory(region);
  const [filter, setFilter] = useState(initialFilter);
  const [selectedOrder, setSelectedOrder] = useState<Order>();
  const visible = orders.filter((order) => matches(order, filter));
  const filterLabel: Record<OrderFilter, string> = {
    all: t('adminDashboard.allRecords'),
    ready: t('adminDashboard.readyStatus'),
    unpaid: t('adminDashboard.unpaid'),
  };

  return (
    <SectionPage
      title={t('adminShell.nav.orders')}
      subtitle={t('adminDashboard.sections.ordersSubtitle')}
    >
      <div className={styles.filterRow}>
        {FILTERS.map((id) => (
          <button
            type="button"
            key={id}
            className={cx(styles.filter, filter === id && styles.filterActive)}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {filterLabel[id]}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorNotice>{error.message}</ErrorNotice>
      ) : loading ? (
        <SectionEmpty label={t('adminDashboard.empty.loadingOrders')} />
      ) : visible.length ? (
        <div className={styles.orderList}>
          {visible.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              money={money}
              onClick={() => setSelectedOrder(order)}
            />
          ))}
        </div>
      ) : (
        <SectionEmpty label={t('adminDashboard.empty.noFilterMatch')} />
      )}
      <OrderDetailDialog order={selectedOrder} onClose={() => setSelectedOrder(undefined)} />
    </SectionPage>
  );
}
