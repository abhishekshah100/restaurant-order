'use client';

import { useState } from 'react';
import { orderTables, useBranchOrderHistory, useTableDetail } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { OrderDetailDialog } from './OrderDetailDialog';
import { OrderRow } from './OrderRow';
import { ErrorNotice, SectionEmpty, SectionPage } from './SectionPage';
import styles from './TablesSection.module.css';

/** /admin/dashboard/tables/: the tables in the branch's orders, then one table's orders and requests. */
export function TablesSection() {
  const t = useContent('common');
  const { region, money } = useAdminWorkspace();
  const { orders } = useBranchOrderHistory(region);
  const [selectedTable, setSelectedTable] = useState<number>();
  const [selectedOrder, setSelectedOrder] = useState<Order>();
  const detail = useTableDetail(region, selectedTable);
  const tables = orderTables(orders);

  return (
    <>
      {selectedTable !== undefined ? (
        <SectionPage
          title={t('adminDashboard.tableNumber', { table: selectedTable })}
          subtitle={t('adminDashboard.tableDetailSubtitle')}
          note={t('adminDashboard.tableSessionLimitation')}
        >
          <button
            type="button"
            className={styles.backToTables}
            onClick={() => setSelectedTable(undefined)}
          >
            <Icon name="back" size="xs" />
            {t('adminDashboard.backToTables')}
          </button>
          {detail.ordersError && <ErrorNotice>{detail.ordersError.message}</ErrorNotice>}
          {detail.ordersLoading ? (
            <SectionEmpty label={t('adminDashboard.empty.loadingOrders')} />
          ) : detail.orders.length ? (
            <div className={styles.orderList}>
              {detail.orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  money={money}
                  onClick={() => setSelectedOrder(order)}
                />
              ))}
            </div>
          ) : (
            <SectionEmpty label={t('adminDashboard.empty.noTableOrders')} />
          )}
          {detail.sessionIds.length > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.detailHeading}>{t('adminDashboard.sessionReferences')}</h2>
              <p className={styles.dataNote}>{t('adminDashboard.sessionStatusUnavailable')}</p>
              {detail.sessionIds.map((sessionId) => (
                <div className={styles.sessionRow} key={sessionId}>
                  <strong>{t('adminDashboard.sessionNumber', { session: sessionId })}</strong>
                  <span>
                    {t('adminDashboard.sessionOrders', {
                      orders: detail.orders
                        .filter((order) => order.sessionId === sessionId)
                        .map((order) => order.id)
                        .join(', '),
                    })}
                  </span>
                </div>
              ))}
              {detail.requestsError && <ErrorNotice>{detail.requestsError.message}</ErrorNotice>}
              {detail.requestsLoading && (
                <p className={styles.dataNote}>{t('adminDashboard.loadingRequests')}</p>
              )}
              {detail.requests.map((request) => (
                <div className={styles.sessionRow} key={request.id}>
                  <strong>
                    {request.kind === 'bill'
                      ? t('adminDashboard.billRequest')
                      : t('adminDashboard.waiterRequest', { reason: request.reason })}
                  </strong>
                  <span>
                    {request.kind === 'bill'
                      ? money.format(request.balance)
                      : (request.note ?? t('adminDashboard.noRequestNote'))}
                  </span>
                </div>
              ))}
              {!detail.requestsLoading && detail.requests.length === 0 && (
                <p className={styles.dataNote}>{t('adminDashboard.noSessionRequests')}</p>
              )}
            </section>
          )}
        </SectionPage>
      ) : (
        <SectionPage
          title={t('adminDashboard.tableRecords')}
          subtitle={t('adminDashboard.sections.tablesSubtitle')}
          note={t('adminDashboard.tableUnavailable')}
        >
          {tables.length ? (
            <div className={styles.tableGridLarge}>
              {tables.map((table) => (
                <button
                  type="button"
                  key={table}
                  className={styles.tableCard}
                  onClick={() => setSelectedTable(table)}
                >
                  <span className={styles.tableCardIcon}>
                    <Icon name="table" />
                  </span>
                  <span>
                    <strong>{t('adminDashboard.tableNumber', { table })}</strong>
                    <small>
                      {t.plural(
                        'adminDashboard.sampleOrders',
                        orders.filter((order) => order.table === table).length,
                      )}
                    </small>
                  </span>
                  <Icon name="chev" size="xs" />
                </button>
              ))}
            </div>
          ) : (
            <SectionEmpty label={t('adminDashboard.empty.noTableReferences')} />
          )}
        </SectionPage>
      )}
      <OrderDetailDialog
        order={selectedOrder}
        money={money}
        onClose={() => setSelectedOrder(undefined)}
      />
    </>
  );
}
