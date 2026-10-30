'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBranchOrders, useContent } from '@/api/hooks';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { Button, Chip, EmptyState, Icon, SearchField, StatusPill } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { useQueryParam } from '@/hooks/useQueryParam';
import { dueOn } from '@/lib/adminOrders';
import { ADMIN_LINKS, tableHistoryPath, tablePath } from '@/lib/adminNav';
import { parseDayRange, shiftDay, type DayRange } from '@/lib/dayRange';
import type { Order } from '@/types/order';
import { DateRangeFilter } from '../DateRangeFilter';
import { PaymentBadge } from '../orders/PaymentBadge';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './TableHistory.module.css';

const OrderDetailDialog = dynamic(
  () => import('../orders/OrderDetailDialog').then((m) => m.OrderDetailDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);

/** What the page opens on: the last 30 days, today included. */
const DEFAULT_DAYS = 30;

type HistoryFilter = 'all' | 'paid' | 'due' | 'cancelled';
const FILTERS: readonly HistoryFilter[] = ['all', 'paid', 'due', 'cancelled'];

const inFilter = (order: Order, filter: HistoryFilter) => {
  if (filter === 'all') return true;
  if (filter === 'cancelled') return order.status === 'cancelled';
  if (order.status === 'cancelled') return false;
  return filter === 'due' ? dueOn(order) > 0 : dueOn(order) <= 0;
};

/**
 * /admin/dashboard/tables/history/?table=5: one table's orders over the days picked (in the
 * address, ?from=&to=; the last 30 without, up to a year back), counted (orders, billed,
 * average bill, cancelled), filtered (all, paid, to collect, cancelled) and searched, the latest
 * first under each day. An order opens with everything on it. Read from
 * GET /admin/branches/:branchId/orders?from=&to=&table=.
 */
export function TableHistory() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock, money } = useAdminWorkspace();
  const hydrated = useHydrated();
  const raw = useQueryParam('table');
  const table = raw && /^\d{1,4}$/.test(raw) ? Number(raw) : null;
  const today = clock.dayKey(new Date());
  const from = useQueryParam('from');
  const to = useQueryParam('to');
  const days: DayRange =
    from || to
      ? parseDayRange(from, to, today)
      : { from: shiftDay(today, -(DEFAULT_DAYS - 1)), to: today };
  // Nothing is read without a table in the address.
  const orders = useBranchOrders(
    table === null ? undefined : branch.id,
    { ...days, ...(table === null ? {} : { table }) },
    days.to === today,
  );
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  if (!hydrated) return <div className={styles.skeleton} />;
  if (table === null) {
    return (
      <EmptyState
        icon="table"
        title={t('adminTables.detail.history.invalid')}
        actions={
          <Button variant="secondary" iconStart="back" href={ADMIN_LINKS.tables}>
            {t('adminShell.nav.tables')}
          </Button>
        }
      />
    );
  }

  let content;
  if (orders.data) {
    // The table's own orders (a filter the server applies; kept here for the mock's sake).
    const all = orders.data.orders
      .filter((o) => o.mode === 'dineIn' && o.table === table)
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
    const counts = Object.fromEntries(
      FILTERS.map((f) => [f, all.filter((o) => inFilter(o, f)).length]),
    ) as Record<HistoryFilter, number>;
    const billedOrders = all.filter((o) => o.status !== 'cancelled');
    const billed = billedOrders.reduce((sum, o) => sum + o.total, 0);
    const q = query.trim().toLowerCase();
    const shown = all.filter(
      (o) =>
        inFilter(o, filter) &&
        (!q || o.id.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q)),
    );
    // Under their day, as placed.
    const byDay: { day: string; orders: Order[] }[] = [];
    for (const order of shown) {
      const day = clock.dayKey(order.placedAt);
      const last = byDay.at(-1);
      if (last?.day === day) last.orders.push(order);
      else byDay.push({ day, orders: [order] });
    }
    const open = openId ? all.find((o) => o.id === openId) : undefined;

    content = (
      <>
        <dl className={styles.stats} aria-label={t('adminTables.detail.history.stats.label')}>
          <div className={styles.stat}>
            <dt>{t('adminTables.detail.history.stats.orders')}</dt>
            <dd>{all.length}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('adminTables.detail.history.stats.billed')}</dt>
            <dd>{money.format(billed)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('adminTables.detail.history.stats.average')}</dt>
            <dd>
              {billedOrders.length > 0
                ? money.format(billed / billedOrders.length)
                : t('adminTables.detail.history.stats.none')}
            </dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('adminTables.detail.history.stats.cancelled')}</dt>
            <dd>{counts.cancelled}</dd>
          </div>
        </dl>

        <section
          className={styles.panel}
          aria-label={t('adminTables.detail.history.title', { table })}
        >
          <div className={styles.tools}>
            <SearchField
              id="table-history-search"
              value={query}
              onChange={setQuery}
              label={t('adminTables.detail.history.search')}
              placeholder={t('adminTables.detail.history.search')}
            />
            <div
              className={styles.filters}
              role="group"
              aria-label={t('adminTables.detail.history.filters.label')}
            >
              {FILTERS.map((f) => (
                <Chip key={f} pressed={filter === f} count={counts[f]} onClick={() => setFilter(f)}>
                  {t(`adminTables.detail.history.filters.${f}`)}
                </Chip>
              ))}
            </div>
          </div>

          {byDay.length > 0 ? (
            byDay.map(({ day, orders: ofDay }) => (
              <section key={day} aria-labelledby={`table-history-${day}`}>
                <h2 id={`table-history-${day}`} className={styles.day}>
                  {t.plural('adminTables.detail.history.day', ofDay.length, {
                    date: clock.date(`${day}T12:00:00Z`),
                  })}
                </h2>
                <ul className={styles.list}>
                  {ofDay.map((order) => (
                    <li key={order.id}>
                      <button
                        type="button"
                        className={styles.row}
                        onClick={() => setOpenId(order.id)}
                      >
                        <span className={styles.time}>{clock.time(order.placedAt)}</span>
                        <span className={styles.main}>
                          <span className={styles.name}>
                            {t('adminTables.detail.history.row', {
                              order: order.id,
                              name: order.customerName,
                            })}
                          </span>
                          <span className={styles.meta}>
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
              </section>
            ))
          ) : (
            <p className={styles.empty}>
              {all.length > 0
                ? t('adminTables.detail.history.filtered')
                : t('adminTables.detail.history.empty')}
            </p>
          )}
        </section>

        {open && <OrderDetailDialog order={open} onClose={() => setOpenId(null)} />}
      </>
    );
  } else if (orders.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminTables.detail.history.failed')}
        actions={
          <Button iconStart="refresh" loading={orders.isFetching} onClick={() => orders.refetch()}>
            {t('adminTables.detail.history.retry')}
          </Button>
        }
      />
    );
  } else {
    content = (
      <div
        className={styles.skeleton}
        role="status"
        aria-label={t('adminTables.detail.history.loading')}
      />
    );
  }

  return (
    <div className={styles.page}>
      <Link href={tablePath(table)} className={styles.back}>
        <Icon name="back" size="xs" />
        {t('adminTables.detail.history.back', { table })}
      </Link>
      <header>
        <h1 className={styles.title}>{t('adminTables.detail.history.title', { table })}</h1>
        <p className={styles.subtitle}>{t('adminTables.detail.history.subtitle')}</p>
      </header>
      <DateRangeFilter
        id="table-history-days"
        range={days}
        today={today}
        onChange={(range) => router.replace(tableHistoryPath(table, range), { scroll: false })}
      />
      {content}
    </div>
  );
}
