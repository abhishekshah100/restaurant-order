'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/api/client';
import { useContent, useTableDetail } from '@/api/hooks';
import { Button, EmptyState, Icon } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { ADMIN_LINKS, floorPath } from '@/lib/adminNav';
import { legendOf } from '@/lib/adminTables';
import { cx } from '@/lib/cx';
import type { AdminTableDetail } from '@/types/admin';
import { OrderDetailDialog } from '../sections/OrderDetailDialog';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { TableOrderCard } from './TableOrderCard';
import { TableRequests } from './TableRequests';
import { useSeatedLabel } from './useSeatedLabel';
import styles from './TableDetail.module.css';

/** Seated time and request ages move on this often. */
const AGE_REFRESH_MS = 20_000;

/**
 * /admin/dashboard/tables/:table/: one table. Where it is and its state, what's open at it
 * (orders, still to pay, seated for), its open requests with Done, and its open orders, newest
 * first; an order opens with everything on it. Read from GET
 * /admin/branches/:branchId/tables/:table, polled every 15 s.
 */
export function TableDetail({ table }: { table: number }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const detail = useTableDetail(branch.id, table);
  const now = useNow(AGE_REFRESH_MS);

  let content;
  if (detail.data) {
    content = <TableContent detail={detail.data} now={now} />;
  } else if (detail.error instanceof ApiError && detail.error.status === 404) {
    content = (
      <EmptyState
        icon="table"
        title={t('adminTables.detail.notFound.title')}
        className={styles.state}
      >
        {t('adminTables.detail.notFound.body', { table })}
      </EmptyState>
    );
  } else if (detail.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminTables.error.title')}
        className={styles.state}
        actions={
          <Button iconStart="refresh" loading={detail.isFetching} onClick={() => detail.refetch()}>
            {t('adminTables.error.retry')}
          </Button>
        }
      >
        {t('adminTables.error.body')}
      </EmptyState>
    );
  } else {
    content = (
      <div className={styles.skeleton} role="status" aria-label={t('adminTables.detail.loading')} />
    );
  }

  return (
    <div className={styles.page}>
      <Link
        href={detail.data ? floorPath(detail.data.floor.id) : ADMIN_LINKS.tables}
        className={styles.back}
      >
        <Icon name="back" size="xs" />
        {t('adminTables.detail.back')}
      </Link>
      {content}
    </div>
  );
}

function TableContent({ detail, now }: { detail: AdminTableDetail; now: Date | null }) {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  const seatedLabel = useSeatedLabel();
  const [openId, setOpenId] = useState<string>();
  // Looked up on every poll, so an open order shows its latest state.
  const openOrder = detail.orders.find((order) => order.id === openId);
  const seated = seatedLabel(detail.seatedAt, now);

  return (
    <>
      <section
        className={cx(styles.hero, styles[legendOf(detail.status)])}
        aria-labelledby="table-title"
      >
        <span className={styles.badge} aria-hidden="true">
          {detail.table}
        </span>
        <div className={styles.heading}>
          <h1 id="table-title" className={styles.title}>
            {t('adminTables.detail.title', { table: detail.table })}
          </h1>
          <p className={styles.where}>
            {t('adminTables.detail.where', {
              floor: detail.floor.name,
              seats: t.plural('adminTables.seats', detail.seats),
            })}
          </p>
        </div>
        <span className={styles.status}>
          <span className={styles.dot} aria-hidden="true" />
          {t(`adminTables.status.${detail.status}`)}
        </span>
        <dl className={styles.stats} aria-label={t('adminTables.detail.stats.label')}>
          <div className={styles.stat}>
            <dt>{t('adminTables.detail.stats.orders')}</dt>
            <dd>{detail.orderCount}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('adminTables.detail.stats.due')}</dt>
            <dd>{money.format(detail.due)}</dd>
          </div>
          {seated && (
            <div className={styles.stat}>
              <dt>{t('adminTables.detail.stats.seated')}</dt>
              <dd>{seated}</dd>
            </div>
          )}
        </dl>
      </section>

      {detail.requests.length > 0 && <TableRequests requests={detail.requests} now={now} />}

      <section className={styles.panel} aria-labelledby="orders-title">
        <header className={styles.panelHead}>
          <h2 id="orders-title" className={styles.panelTitle}>
            {t('adminTables.detail.orders.title')}
          </h2>
          <p className={styles.panelSubtitle}>{t('adminTables.detail.orders.subtitle')}</p>
        </header>
        {detail.orders.length > 0 ? (
          <ul className={styles.orders}>
            {detail.orders.map((order) => (
              <li key={order.id}>
                <TableOrderCard order={order} onOpen={() => setOpenId(order.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <Icon name="check" size="md" />
            </span>
            <p className={styles.emptyTitle}>{t('adminTables.detail.empty.title')}</p>
            <p className={styles.emptyBody}>{t('adminTables.detail.empty.body')}</p>
          </div>
        )}
      </section>

      <OrderDetailDialog order={openOrder} onClose={() => setOpenId(undefined)} />
    </>
  );
}
