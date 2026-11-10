'use client';

import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { HistoryOrder, OrderHistoryResponse, OrderHistoryStatus } from '@/api/contracts';
import { api } from '@/api/endpoints';
import { branchOrderQuery, useBranchOrder, useContent, useOrderHistory } from '@/api/hooks';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { Button, Chip, EmptyState, Icon, SearchField, StatusPill } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { orderHistoryPath, ordersPath } from '@/lib/adminNav';
import { MODE_FILTERS, type ModeFilter } from '@/lib/adminOrders';
import { cx } from '@/lib/cx';
import { ORDER_HISTORY_LIMITS, parseDayRange, shiftDay, type DayRange } from '@/lib/dayRange';
import { downloadXlsx, toXlsx } from '@/lib/xlsx';
import { DateRangeFilter } from '../DateRangeFilter';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { PaymentBadge } from './PaymentBadge';
import styles from './OrderHistory.module.css';

const OrderDetailDialog = dynamic(
  () => import('./OrderDetailDialog').then((m) => m.OrderDetailDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);

const STATUSES: readonly OrderHistoryStatus[] = ['all', 'completed', 'unpaid', 'cancelled'];
const parseStatus = (value: string | null): OrderHistoryStatus =>
  STATUSES.find((s) => s === value) ?? 'all';
/** Without days in the address: the last week, today included. */
const DEFAULT_DAYS = 7;
const PRESETS = [
  { days: 7, key: 'week' },
  { days: 30, key: 'month' },
  { days: 91, key: 'quarter' },
  { days: 182, key: 'half' },
  { days: 365, key: 'year' },
] as const;

/**
 * /admin/dashboard/orders/history/: the branch's orders over the days picked, on a page of its
 * own (today's Orders stays about today). Quick ranges (7 days to a year) or any From–To up to a
 * year, back two years. The totals are summed on the server, so a year is exact: sales, orders
 * completed and cancelled, the average bill, what's still to collect, by order type; then every
 * order under its day, newest first, 30 at a time, searchable and filtered (the filters narrow
 * the list, not the totals), with an Excel export of all of them. An order opens with
 * everything on it (an unpaid one can still be collected).
 */
export function OrderHistory() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock } = useAdminWorkspace();
  const token = useAdminToken();
  const { showToast } = useToast();
  const text = usePaymentText();
  const now = useNow(60_000);
  const today = clock.dayKey(now ?? new Date());
  const fromParam = useQueryParam('from');
  const toParam = useQueryParam('to');
  const days: DayRange =
    fromParam || toParam
      ? parseDayRange(fromParam, toParam, today, ORDER_HISTORY_LIMITS)
      : { from: shiftDay(today, -(DEFAULT_DAYS - 1)), to: today };
  const status = parseStatus(useQueryParam('status'));
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<ModeFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const opened = useBranchOrder(branch.id, openId);

  // Searching waits for a pause in typing (each search asks the server).
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(typed.trim()), 300);
    return () => window.clearTimeout(id);
  }, [typed]);

  /** Reads the order, then opens it (one that can't be read is said so). */
  const openOrder = async (id: string) => {
    setLoadingId(id);
    try {
      await queryClient.fetchQuery(branchOrderQuery(token, branch.id, id));
      setOpenId(id);
    } catch {
      showToast(t('adminOrders.history.openFailed'), { tone: 'error' });
    } finally {
      setLoadingId(null);
    }
  };

  const query = {
    from: days.from,
    to: days.to,
    status,
    mode,
    ...(search ? { q: search } : {}),
  };
  const history = useOrderHistory(branch.id, query);
  const pages = history.data?.pages ?? [];
  const first: OrderHistoryResponse | undefined = pages[0];
  const orders = pages.flatMap((p) => p.orders);

  const goTo = (range: DayRange, next: OrderHistoryStatus = status) =>
    router.replace(orderHistoryPath(range, next), { scroll: false });
  const dayLabel = (key: string) => clock.date(`${key}T12:00:00Z`);
  const period =
    days.from === days.to
      ? t('adminOrders.history.period.day', { date: dayLabel(days.from) })
      : t('adminOrders.history.period.range', {
          from: dayLabel(days.from),
          to: dayLabel(days.to),
        });

  const cancelText = (o: HistoryOrder) =>
    o.cancelledBy === 'guest'
      ? t('adminOrders.history.row.cancelledByGuest')
      : t('adminOrders.history.row.cancelled', {
          reason: t(`adminOrder.cancel.reasons.${o.cancelReason ?? 'other'}`),
        });
  const paymentText = (o: HistoryOrder) => t(`adminDashboard.paymentStatus.${o.paymentStatus}`);

  /** Every matching order, a thousand at a time, into one Excel file (oldest first). */
  const exportAll = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const all: HistoryOrder[] = [];
      let cursor: string | undefined;
      do {
        const page = await api.orderHistory(token, branch.id, {
          ...query,
          limit: 1000,
          ...(cursor ? { cursor } : {}),
        });
        all.push(...page.orders);
        cursor = page.next;
      } while (cursor);
      const c = (key: Parameters<typeof t>[0]) => t(key);
      const workbook = toXlsx(
        t('adminOrders.history.title'),
        all.reverse(),
        [
          c('adminOrders.history.columns.time'),
          c('adminOrders.history.columns.order'),
          c('adminOrders.history.columns.where'),
          c('adminOrders.history.columns.guest'),
          c('adminOrders.history.columns.items'),
          c('adminOrders.history.columns.total'),
          c('adminOrders.history.columns.payment'),
          c('adminOrders.history.columns.due'),
          c('adminOrders.history.columns.method'),
          c('adminOrders.history.columns.status'),
          c('adminOrders.history.columns.cancelReason'),
          c('adminOrders.history.columns.takenBy'),
        ],
        (o: HistoryOrder) => [
          clock.dateTime(o.placedAt),
          o.id,
          text.where(o),
          o.customerName,
          o.items,
          o.total,
          o.status === 'cancelled' ? '' : paymentText(o),
          o.due || '',
          text.methodName(o.method),
          t(`orderStatus.${o.status}`),
          o.status === 'cancelled' ? cancelText(o) : '',
          o.takenBy ?? t('adminOrders.history.row.byGuest'),
        ],
      );
      downloadXlsx(
        workbook,
        t('adminOrders.history.exportFile', {
          branch: branch.id,
          date: days.from === days.to ? days.from : `${days.from}_${days.to}`,
        }),
      );
    } catch {
      showToast(t('adminOrders.history.exportFailed'), { tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  let content;
  if (first) {
    const { summary } = first;
    const filtered = search !== '' || mode !== 'all' || status !== 'all';
    const statusCount: Record<OrderHistoryStatus, number> = {
      all: summary.orders,
      completed: summary.completed,
      unpaid: summary.unpaidOrders,
      cancelled: summary.cancelled,
    };
    // Under their day, as placed.
    const byDay: { day: string; orders: HistoryOrder[] }[] = [];
    for (const order of orders) {
      const day = clock.dayKey(order.placedAt);
      const last = byDay.at(-1);
      if (last?.day === day) last.orders.push(order);
      else byDay.push({ day, orders: [order] });
    }

    content = (
      <>
        <section className={styles.summary} aria-labelledby="order-history-sales">
          <div className={styles.hero}>
            <p className={styles.eyebrow}>{period}</p>
            <h2 id="order-history-sales" className={styles.heroLabel}>
              {t('adminOrders.history.sales')}
            </h2>
            <p className={styles.sales}>{text.amount(summary.sales)}</p>
            <p className={styles.heroHint}>
              {t('adminOrders.history.salesHint', {
                orders: t.plural('adminOrders.history.orders', summary.orders - summary.cancelled),
              })}
            </p>
            {summary.byMode.length > 0 && (
              <div className={styles.modes}>
                {summary.byMode.map((m) => (
                  <span key={m.mode}>
                    {t(`modes.${m.mode}`)} <b>{text.amount(m.sales)}</b>{' '}
                    <span className={styles.modeCount}>
                      ({t.plural('adminOrders.history.orders', m.orders)})
                    </span>
                  </span>
                ))}
              </div>
            )}
            <div className={styles.heroActions}>
              <Button
                variant="secondary"
                size="sm"
                iconStart="list"
                loading={exporting}
                disabled={summary.orders === 0}
                onClick={() => void exportAll()}
              >
                {exporting ? t('adminOrders.history.exporting') : t('adminOrders.history.export')}
              </Button>
            </div>
          </div>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>
                <Icon name="receipt" size="xs" />
                {t('adminOrders.history.kpis.orders')}
              </span>
              <span className={styles.kpiValue}>{summary.orders}</span>
              <span className={styles.kpiHint}>
                {t('adminOrders.history.kpis.ordersHint', {
                  completed: summary.completed,
                  cancelled: summary.cancelled,
                })}
                {summary.inProgress > 0 &&
                  ` · ${t('adminOrders.history.kpis.inProgress', { count: summary.inProgress })}`}
              </span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>
                <Icon name="tag" size="xs" />
                {t('adminOrders.history.kpis.average')}
              </span>
              <span className={styles.kpiValue}>{text.amount(summary.averageBill)}</span>
              <span className={styles.kpiHint}>{t('adminOrders.history.kpis.averageHint')}</span>
            </div>
            <button
              type="button"
              className={cx(styles.kpi, styles.kpiButton, summary.unpaid > 0 && styles.toCollect)}
              disabled={summary.unpaidOrders === 0}
              onClick={() => goTo(days, 'unpaid')}
            >
              <span className={styles.kpiLabel}>
                <Icon name="cash" size="xs" />
                {t('adminOrders.history.kpis.unpaid')}
              </span>
              <span className={styles.kpiValue}>{text.amount(summary.unpaid)}</span>
              <span className={styles.kpiHint}>
                {summary.unpaidOrders > 0
                  ? t.plural('adminOrders.history.kpis.unpaidHint', summary.unpaidOrders)
                  : t('adminOrders.history.kpis.unpaidNone')}
              </span>
            </button>
          </div>
        </section>
        <p className={styles.note}>
          <Icon name="info" size="xs" />
          {t('adminOrders.history.note')}
        </p>

        <section className={styles.panel} aria-label={t('adminOrders.history.title')}>
          <div className={styles.tools}>
            <div
              className={styles.chips}
              role="group"
              aria-label={t('adminOrders.history.statuses.label')}
            >
              {STATUSES.map((s) => (
                <Chip
                  key={s}
                  pressed={status === s}
                  count={statusCount[s]}
                  onClick={() => goTo(days, s)}
                >
                  {t(`adminOrders.history.statuses.${s}`)}
                </Chip>
              ))}
            </div>
            <SearchField
              id="order-history-search"
              value={typed}
              onChange={setTyped}
              label={t('adminOrders.history.search')}
              placeholder={t('adminOrders.history.search')}
            />
            <div className={styles.chips} role="group" aria-label={t('adminOrders.modes.label')}>
              {MODE_FILTERS.map((m) => (
                <Chip key={m} pressed={mode === m} onClick={() => setMode(m)}>
                  {m === 'all' ? t('adminOrders.modes.all') : t(`modes.${m}`)}
                </Chip>
              ))}
            </div>
          </div>

          {byDay.length > 0 ? (
            <>
              {byDay.map(({ day, orders: ofDay }) => (
                <section key={day} aria-labelledby={`order-history-${day}`}>
                  <h3 id={`order-history-${day}`} className={styles.day}>
                    {t.plural('adminOrders.history.day', ofDay.length, { date: dayLabel(day) })}
                  </h3>
                  <ul className={styles.list}>
                    {ofDay.map((order) => (
                      <li key={order.id}>
                        <button
                          type="button"
                          className={styles.row}
                          aria-label={t('adminOrders.history.row.open', { order: order.id })}
                          disabled={loadingId !== null}
                          onClick={() => void openOrder(order.id)}
                        >
                          <span className={styles.time}>{clock.time(order.placedAt)}</span>
                          <span className={styles.main}>
                            <span className={styles.name}>
                              {t('adminOrders.history.row.title', {
                                order: order.id,
                                name: order.customerName,
                              })}
                            </span>
                            <span className={styles.meta}>
                              {[
                                text.where(order),
                                t.plural('adminOrders.history.row.items', order.items),
                                order.takenBy
                                  ? t('adminOrders.history.row.takenBy', { name: order.takenBy })
                                  : t('adminOrders.history.row.byGuest'),
                              ].join(' · ')}
                            </span>
                            {order.status === 'cancelled' && (
                              <span className={styles.cancelled}>{cancelText(order)}</span>
                            )}
                          </span>
                          <span className={styles.side}>
                            <span
                              className={cx(
                                styles.total,
                                order.status === 'cancelled' && styles.struck,
                              )}
                            >
                              {text.amount(order.total)}
                            </span>
                            {order.status === 'cancelled' ? (
                              <StatusPill status={order.status} />
                            ) : order.due > 0 ? (
                              <span className={styles.due}>
                                {t('adminOrders.history.row.due', {
                                  amount: text.amount(order.due),
                                })}
                              </span>
                            ) : (
                              <PaymentBadge status={order.paymentStatus}>
                                {paymentText(order)}
                              </PaymentBadge>
                            )}
                          </span>
                          <Icon name="chev" size="sm" className={styles.chevron} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <div className={styles.more}>
                <span className="t-small c3">
                  {t('adminOrders.history.showing', {
                    shown: orders.length,
                    total: first.matching,
                  })}
                </span>
                {history.hasNextPage && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={history.isFetchingNextPage}
                    onClick={() => void history.fetchNextPage()}
                  >
                    {t('adminOrders.history.more')}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={filtered ? 'search' : 'receipt'}
              tone="neutral"
              title={
                filtered
                  ? t('adminOrders.history.empty.filteredTitle')
                  : t('adminOrders.history.empty.title')
              }
              className={styles.state}
            >
              {search
                ? t('adminOrders.history.empty.search', { query: search })
                : filtered
                  ? t('adminOrders.history.empty.filtered')
                  : t('adminOrders.history.empty.body')}
            </EmptyState>
          )}
        </section>

        {loadingId && <LoadingSignal />}
        {openId && opened.data && (
          <OrderDetailDialog order={opened.data} onClose={() => setOpenId(null)} />
        )}
      </>
    );
  } else if (history.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminHome.error.title')}
        className={styles.state}
        actions={
          <Button
            iconStart="refresh"
            loading={history.isFetching}
            onClick={() => void history.refetch()}
          >
            {t('adminHome.error.retry')}
          </Button>
        }
      >
        {t('adminHome.error.body')}
      </EmptyState>
    );
  } else {
    content = (
      <div
        className={styles.skeleton}
        role="status"
        aria-label={t('adminOrders.history.loading')}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <Link href={ordersPath('active')} className={styles.back}>
          <Icon name="back" size="sm" />
          {t('adminOrders.history.back')}
        </Link>
        <h1 className={styles.title}>{t('adminOrders.history.title')}</h1>
        <p className={styles.subtitle}>{t('adminOrders.history.subtitle')}</p>
      </div>
      <DateRangeFilter
        id="order-history-days"
        range={days}
        today={today}
        limits={ORDER_HISTORY_LIMITS}
        presets={PRESETS.map((p) => ({
          days: p.days,
          label: t(`adminOrders.history.presets.${p.key}`),
        }))}
        onChange={(range) => goTo(range)}
      />
      {content}
    </div>
  );
}
