'use client';

import dynamic from 'next/dynamic';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBranchOrders, useContent } from '@/api/hooks';
import { useMarkServed } from '@/api/mutations';
import { Button, Chip, EmptyState, Icon, SearchField } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { ordersPath } from '@/lib/adminNav';
import {
  MODE_FILTERS,
  ORDER_VIEWS,
  filterOrders,
  modeCounts,
  parseView,
  todayTotals,
  viewCounts,
  type ModeFilter,
  type OrderAction,
  type OrderView,
} from '@/lib/adminOrders';
import { cx } from '@/lib/cx';
import {
  inDayRange,
  isTodayOnly,
  ordersFilter,
  parseDayRange,
  type DayRange,
} from '@/lib/dayRange';
import type { Order } from '@/types/order';
import { DateRangeFilter } from '../DateRangeFilter';
import type { PadTarget } from '../orderPad/OrderPad';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import type { OrderDialogView } from './OrderDetailDialog';
import { OrderListItem } from './OrderListItem';
import styles from './OrdersBoard.module.css';

// Popups: each downloaded the first time it opens.
const OrderPad = dynamic(() => import('../orderPad/OrderPad').then((m) => m.OrderPad), {
  ssr: false,
  loading: () => <LoadingSignal />,
});
const OrderDetailDialog = dynamic(
  () => import('./OrderDetailDialog').then((m) => m.OrderDetailDialog),
  {
    ssr: false,
    loading: () => <LoadingSignal />,
  },
);

/** Ages ("12 min ago") move on this often. */
const AGE_REFRESH_MS = 20_000;

/**
 * /admin/dashboard/orders/ (and its ready/ and unpaid/ pages): today's orders across dine-in,
 * takeaway and delivery, or those of the days picked (?from=&to=, up to 90 days back). Today's totals; a status view (in the address); type and search
 * filters; a row per order with the action it needs next (Mark served, Handed over, Collect);
 * and the order itself — collect payment, add items, cancel. Read from GET
 * /admin/branches/:branchId/orders, polled every 15 s.
 */
export function OrdersBoard({ routeView }: { routeView?: OrderView }) {
  // The ready/ and unpaid/ pages open on their view; switching goes to ?view= on this page.
  const t = useContent('common');
  const router = useRouter();
  const { branch, money, clock } = useAdminWorkspace();
  const now = useNow(AGE_REFRESH_MS);
  const today = clock.dayKey(now ?? new Date());
  const days = parseDayRange(useQueryParam('from'), useQueryParam('to'), today);
  // Today is the live list everyone shares (polled); past days are read once.
  const orders = useBranchOrders(branch.id, ordersFilter(days, today), days.to === today);
  const queryView = useQueryParam('view');
  const view = queryView !== null || !routeView ? parseView(queryView) : routeView;
  const [mode, setMode] = useState<ModeFilter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<{ id: string; view: OrderDialogView } | null>(null);
  const [pad, setPad] = useState<PadTarget | null>(null);
  const { showToast } = useToast();
  const serve = useMarkServed();

  const goTo = (next: OrderView, range: DayRange = days) =>
    router.replace(ordersPath(next, isTodayOnly(range, today) ? undefined : range), {
      scroll: false,
    });

  const onAction = (order: Order, action: OrderAction) => {
    if (action === 'collect') {
      setOpen({ id: order.id, view: 'collect' });
      return;
    }
    serve.mutate(
      { branchId: branch.id, orderId: order.id },
      { onError: () => showToast(t('adminOrders.failed'), { tone: 'error' }) },
    );
  };

  let content;
  if (orders.data) {
    const all = orders.data.orders;
    // Up to today the list also has yesterday's bills still to pay (listed, under Unpaid);
    // the totals are the days' own.
    const totals = todayTotals(all.filter((o) => inDayRange(clock.dayKey(o.placedAt), days)));
    const listed = filterOrders(all, { view, mode, query });
    const byView = viewCounts(all, { mode, query });
    const byMode = modeCounts(all, { view, query });
    // Looked up on every poll, so an open order shows its latest state.
    const openOrder = open ? all.find((o) => o.id === open.id) : undefined;

    content = (
      <>
        <dl className={styles.totals} aria-label={t('adminOrders.today.label')}>
          <div className={styles.total}>
            <dt>{t('adminOrders.today.orders')}</dt>
            <dd>{totals.count}</dd>
          </div>
          <div className={styles.total}>
            <dt>{t('adminOrders.today.sales')}</dt>
            <dd>{money.format(totals.sales)}</dd>
          </div>
          <div className={cx(styles.total, totals.toCollect > 0 && styles.toCollect)}>
            <dt>{t('adminOrders.today.toCollect')}</dt>
            <dd>{money.format(totals.toCollect)}</dd>
          </div>
        </dl>

        <div className={styles.views} role="group" aria-label={t('adminOrders.views.label')}>
          {ORDER_VIEWS.map((v) => (
            <Chip key={v} pressed={view === v} count={byView[v]} onClick={() => goTo(v)}>
              {t(`adminOrders.views.${v}`)}
            </Chip>
          ))}
        </div>

        <section className={styles.panel} aria-label={t(`adminOrders.views.${view}`)}>
          <div className={styles.tools}>
            <SearchField
              value={query}
              onChange={setQuery}
              label={t('adminOrders.search')}
              placeholder={t('adminOrders.search')}
              className={styles.search}
            />
            <div className={styles.modes} role="group" aria-label={t('adminOrders.modes.label')}>
              {MODE_FILTERS.map((m) => (
                <Chip key={m} pressed={mode === m} count={byMode[m]} onClick={() => setMode(m)}>
                  {m === 'all' ? t('adminOrders.modes.all') : t(`modes.${m}`)}
                </Chip>
              ))}
            </div>
          </div>

          {listed.length > 0 ? (
            <ul className={styles.list}>
              {listed.map((order) => (
                <OrderListItem
                  key={order.id}
                  order={order}
                  now={now}
                  onOpen={() => setOpen({ id: order.id, view: 'details' })}
                  onAction={(action) => onAction(order, action)}
                />
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <Icon name="receipt" size="md" />
              </span>
              <p className={styles.emptyTitle}>{t('adminOrders.empty.title')}</p>
              <p className={styles.emptyBody}>
                {query.trim()
                  ? t('adminOrders.empty.search', { query: query.trim() })
                  : t(`adminOrders.empty.${view}`)}
              </p>
            </div>
          )}
        </section>

        {openOrder && (
          <OrderDetailDialog
            order={openOrder}
            initialView={open?.view}
            onClose={() => setOpen(null)}
            onAddItems={(order) => {
              setOpen(null);
              if (order.table !== undefined) setPad({ kind: 'add', table: order.table, order });
            }}
          />
        )}
        {pad && <OrderPad target={pad} onClose={() => setPad(null)} />}
      </>
    );
  } else if (orders.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminHome.error.title')}
        className={styles.state}
        actions={
          <Button iconStart="refresh" loading={orders.isFetching} onClick={() => orders.refetch()}>
            {t('adminHome.error.retry')}
          </Button>
        }
      >
        {t('adminHome.error.body')}
      </EmptyState>
    );
  } else {
    content = (
      <div className={styles.skeleton} role="status" aria-label={t('adminOrders.loading')} />
    );
  }

  return (
    <div className={styles.page}>
      {/* The bar above already names the page; the heading is for screen readers. */}
      <h1 className="visually-hidden">{t('adminOrders.title')}</h1>
      <DateRangeFilter
        id="orders-days"
        range={days}
        today={today}
        onChange={(range) => goTo(view, range)}
      />
      {content}
    </div>
  );
}
