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
import { editableRound } from '@/lib/adminOrders';
import type { AdminTableDetail } from '@/types/admin';
import type { Order } from '@/types/order';
import { OrderPad, type PadTarget } from '../orderPad/OrderPad';
import { OrderDetailDialog, type OrderDialogView } from '../orders/OrderDetailDialog';
import { ReservationEditor, type EditorTarget } from '../reservations/ReservationEditor';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { FreeTableDialog } from './FreeTableDialog';
import { TableQrDialog } from './qr/TableQrDialog';
import { TableBookings } from './TableBookings';
import { TableCollectDialog } from './TableCollectDialog';
import { TableOrderCard } from './TableOrderCard';
import { TableRequests } from './TableRequests';
import { useSeatedLabel } from './useSeatedLabel';
import styles from './TableDetail.module.css';

/** Seated time and request ages move on this often. */
const AGE_REFRESH_MS = 20_000;

/**
 * /admin/dashboard/tables/:table/: one table. Where it is and its state, what's open at it
 * (orders, still to pay, seated for), today's bookings with Seat, its open requests with Done,
 * and its open orders, newest first; an order opens with everything on it. Reserve books it. Read from GET
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
  const { money, clock } = useAdminWorkspace();
  const seatedLabel = useSeatedLabel();
  const [open, setOpen] = useState<{ id: string; view: OrderDialogView } | null>(null);
  const [pad, setPad] = useState<PadTarget | null>(null);
  const [collectingTable, setCollectingTable] = useState(false);
  const [freeing, setFreeing] = useState(false);
  const [showingQr, setShowingQr] = useState(false);
  const [booking, setBooking] = useState<EditorTarget | null>(null);
  // Looked up on every poll, so an open order shows its latest state.
  const openOrder = open ? detail.orders.find((order) => order.id === open.id) : undefined;
  const addItems = (order: Order) => {
    setOpen(null);
    setPad({ kind: 'add', table: detail.table, order });
  };
  /** Changing the round the kitchen hasn't finished; undefined when there's none. */
  const changeItems = (order: Order) => {
    const round = editableRound(order);
    if (!round) return undefined;
    return () => {
      setOpen(null);
      setPad({ kind: 'edit', table: detail.table, order, round });
    };
  };
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
          <span className={styles.statusRow}>
            <span className={styles.status}>
              <span className={styles.dot} aria-hidden="true" />
              {t(`adminTables.status.${detail.status}`)}
            </span>
            <button
              type="button"
              className={styles.free}
              onClick={() => setBooking({ kind: 'new', table: detail.table })}
            >
              <Icon name="calendar" size="xs" />
              {t('adminTables.detail.reserve')}
            </button>
            <button type="button" className={styles.free} onClick={() => setShowingQr(true)}>
              <Icon name="qr" size="xs" />
              {t('adminQr.tableButton')}
            </button>
            {detail.status !== 'available' && detail.status !== 'reserved' && (
              <button type="button" className={styles.free} onClick={() => setFreeing(true)}>
                <Icon name="check" size="xs" />
                {t('adminTables.detail.free.action')}
              </button>
            )}
          </span>
        </div>
        <Button
          iconStart="plus"
          className={styles.takeOrder}
          onClick={() => setPad({ kind: 'new', table: detail.table })}
        >
          {/* With orders open, a new one is a separate bill; Add items goes on an order's own. */}
          {detail.orders.length > 0
            ? t('adminTables.detail.newOrder')
            : t('adminTables.detail.takeOrder')}
        </Button>
        {detail.due > 0 && (
          <Button
            variant="secondary"
            iconStart="cash"
            className={styles.collectTable}
            onClick={() => setCollectingTable(true)}
          >
            {t('adminTables.detail.collectTable', { amount: money.format(detail.due) })}
          </Button>
        )}
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

      {detail.reservations.length > 0 && (
        <TableBookings
          reservations={detail.reservations}
          now={(now ?? new Date(detail.generatedAt)).getTime()}
          onEdit={setBooking}
        />
      )}

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
                <TableOrderCard
                  order={order}
                  onOpen={() => setOpen({ id: order.id, view: 'details' })}
                  onAddItems={() => addItems(order)}
                  onChange={changeItems(order)}
                  onCollect={() => setOpen({ id: order.id, view: 'collect' })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <Icon name="check" size="md" />
            </span>
            <p className={styles.emptyTitle}>{t('adminTables.detail.empty.title')}</p>
            <p className={styles.emptyBody}>
              {detail.status === 'reserved' && detail.booking
                ? t('adminTables.detail.empty.reserved', {
                    name: detail.booking.guestName,
                    time: clock.time(detail.booking.at),
                  })
                : t('adminTables.detail.empty.body')}
            </p>
          </div>
        )}
      </section>

      <OrderDetailDialog
        order={openOrder}
        initialView={open?.view}
        onClose={() => setOpen(null)}
        onAddItems={addItems}
        onChangeItems={(order) => changeItems(order)?.()}
      />
      <OrderPad target={pad} onClose={() => setPad(null)} />
      {collectingTable && (
        <TableCollectDialog detail={detail} onClose={() => setCollectingTable(false)} />
      )}
      {freeing && <FreeTableDialog detail={detail} onClose={() => setFreeing(false)} />}
      {showingQr && <TableQrDialog table={detail.table} onClose={() => setShowingQr(false)} />}
      <ReservationEditor target={booking} onClose={() => setBooking(null)} />
    </>
  );
}
