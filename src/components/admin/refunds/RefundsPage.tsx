'use client';

import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  branchOrderQuery,
  useBranchOrder,
  useBranchOrders,
  useContent,
  usePaymentHistory,
} from '@/api/hooks';
import { useRefundReceived } from '@/api/mutations';
import { Button, Chip, Icon, SearchField, Select } from '@/components/ui';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { cx } from '@/lib/cx';
import {
  dayCount,
  daysBefore,
  groupByDay,
  ordersFilter,
  shiftDay,
  type DayRange,
} from '@/lib/dayRange';
import {
  filterRefunds,
  isLateRefund,
  reasonTotals,
  refundEntriesOf,
  refundStaff,
  refundsEntries,
  refundsSummary,
  type RefundsEntry,
  type RefundsFilters,
} from '@/lib/refundsReport';
import type { Order } from '@/types/order';
import { DateRangeFilter } from '../DateRangeFilter';
import { toLine } from '../payments/historyLines';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { OrderPicker } from './OrderPicker';
import styles from './RefundsPage.module.css';

const RefundDialog = dynamic(() => import('../payments/RefundDialog').then((m) => m.RefundDialog), {
  ssr: false,
  loading: () => <LoadingSignal />,
});
const OrderDetailDialog = dynamic(
  () => import('../orders/OrderDetailDialog').then((m) => m.OrderDetailDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);

const RANGES = ['today', 'week', 'month', 'custom'] as const;
type RangeId = (typeof RANGES)[number];
/** A busy month's refunds, read at once. */
const REFUNDS_PAGE = 1000;
/** Online refunds still on their way are looked for this far back, whatever days are shown. */
const WAITING_DAYS = 30;

/** The days a quick range covers, from today (the branch's). */
const daysOf = (range: Exclude<RangeId, 'custom'>, today: string): DayRange =>
  range === 'today'
    ? { from: today, to: today }
    : range === 'week'
      ? { from: shiftDay(today, -6), to: today }
      : { from: `${today.slice(0, 8)}01`, to: today };

type Open =
  | { kind: 'pick'; action: 'refund' | 'cancel' }
  | { kind: 'refund'; order: Order }
  | { kind: 'cancel'; order: Order }
  | { kind: 'view'; order: Order }
  | null;

/**
 * /admin/dashboard/refunds/: refunds and cancellations. Refund an order and Cancel an order at
 * the top (pick the order, then the same window Orders and Payments use). Today, the last 7
 * days, this month or days picked: money given back (refunds on the day they were given, from
 * the payments), orders cancelled (on the day of the order), online refunds still on the way
 * (Guest got it once the guest has the money), why, and every one by day, with All / Refunds /
 * Cancellations, a search, and More filters (reason, who gave it back). Money given back is
 * compared with the same number of days just before; online refunds on their way are every one
 * from the last 30 days (late after 7); a row opens its order.
 */
export function RefundsPage() {
  const t = useContent('common');
  const { branch, clock, money, can } = useAdminWorkspace();
  const { methodName } = usePaymentText();
  const { showToast } = useToast();
  const now = useNow();
  const today = clock.dayKey(now ?? new Date());
  const [range, setRange] = useState<RangeId>('week');
  const [custom, setCustom] = useState<DayRange>({ from: shiftDay(today, -6), to: today });
  const days = range === 'custom' ? custom : daysOf(range, today);
  const [filters, setFilters] = useState<RefundsFilters>({
    kind: 'all',
    reason: 'all',
    staff: 'all',
    query: '',
  });
  const [moreFilters, setMoreFilters] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const refunds = usePaymentHistory(branch.id, {
    from: days.from,
    to: days.to,
    kind: 'refunds',
    limit: REFUNDS_PAGE,
  });
  const orders = useBranchOrders(branch.id, ordersFilter(days, today), days.to === today);
  // Every online refund still on its way (not only the days shown): a late one isn't missed.
  const waiting = usePaymentHistory(branch.id, {
    from: shiftDay(today, -(WAITING_DAYS - 1)),
    to: today,
    kind: 'refunds',
    limit: REFUNDS_PAGE,
  });
  // The same number of days just before, to compare (only its total is read).
  const before = daysBefore(days);
  const earlier = usePaymentHistory(branch.id, {
    from: before.from,
    to: before.to,
    kind: 'refunds',
    limit: 1,
  });
  const received = useRefundReceived();
  // Try again after a failed read. (After a refund, a cancellation or a refund received, what
  // changed is read again by the central list, api/refreshAfter.)
  const retry = () => {
    void refunds.refetch();
    void orders.refetch();
    void waiting.refetch();
  };
  // A row opens its order (read first: refunded orders can be from days before).
  const token = useAdminToken();
  const queryClient = useQueryClient();
  const [openingId, setOpeningId] = useState<string | null>(null);
  // Kept fresh while it's open (a refund given from it shows at once).
  const viewed = useBranchOrder(branch.id, open?.kind === 'view' ? open.order.id : null);
  const openOrder = async (orderId: string) => {
    setOpeningId(orderId);
    try {
      const order = await queryClient.fetchQuery(branchOrderQuery(token, branch.id, orderId));
      setOpen({ kind: 'view', order });
    } catch {
      showToast(t('adminRefunds.list.openFailed'), { tone: 'error' });
    } finally {
      setOpeningId(null);
    }
  };
  const late = (e: RefundsEntry) => isLateRefund(e, now ?? new Date());

  const reasonLabel = (kind: RefundsEntry['kind'], reason: string) =>
    !reason
      ? t('adminRefunds.reasons.none')
      : kind === 'refund'
        ? t(`adminPayments.entry.reasons.${reason as 'complaint'}`)
        : reason;

  let content;
  if (refunds.isError || orders.isError) {
    content = (
      <div className={styles.card}>
        <p>{t('adminRefunds.failed')}</p>
        <Button variant="secondary" onClick={retry}>
          {t('adminRefunds.retry')}
        </Button>
      </div>
    );
  } else if (!refunds.data || !orders.data) {
    content = (
      <p className={styles.muted} aria-busy="true">
        {t('adminRefunds.loading')}
      </p>
    );
  } else {
    const lines = refunds.data.pages.flatMap((p) => p.transactions).map(toLine);
    const entries = refundsEntries(lines, orders.data.orders);
    const summary = refundsSummary(entries);
    const reasons = reasonTotals(entries);
    const staff = refundStaff(entries);
    // Every online refund on its way from the last 30 days (the days shown, until that's read).
    const pending = waiting.data
      ? refundEntriesOf(waiting.data.pages.flatMap((p) => p.transactions).map(toLine)).filter(
          (e) => e.pending,
        )
      : entries.filter((e) => e.kind === 'refund' && e.pending);
    const pendingAmount = pending.reduce((sum, e) => sum + e.amount, 0);
    const lateCount = pending.filter(late).length;
    const earlierTotal = earlier.data?.pages[0]?.summary.refunds;
    const span = dayCount(days);
    const shown = filterRefunds(entries, filters);
    const filtered =
      filters.kind !== 'all' ||
      filters.reason !== 'all' ||
      filters.staff !== 'all' ||
      filters.query.trim() !== '';
    const counts = {
      all: entries.length,
      refund: entries.filter((e) => e.kind === 'refund').length,
      cancel: entries.filter((e) => e.kind === 'cancel').length,
    };
    const largest = Math.max(1, ...reasons.map((r) => r.amount));
    const markReceived = (e: RefundsEntry) =>
      e.kind === 'refund' &&
      received.mutate(
        { branchId: branch.id, orderId: e.order.id, seq: e.seq },
        {
          onSuccess: () => {
            showToast(t('adminRefunds.pending.receivedToast', { order: e.order.id }), {
              tone: 'success',
            });
          },
          onError: () => showToast(t('adminRefunds.pending.failed'), { tone: 'error' }),
        },
      );
    const byDay = groupByDay(shown, (e) => clock.dayKey(e.at));

    content = (
      <>
        <dl className={styles.tiles}>
          <div className={styles.tile}>
            <dt className={styles.tileLabel}>
              <Icon name="refresh" size="xs" />
              {t('adminRefunds.summary.refunded')}
            </dt>
            <dd className={styles.tileValue}>{money.format(summary.refunded)}</dd>
            <dd className={styles.tileSub}>
              {t('adminRefunds.summary.refundedSub', {
                inPerson: money.format(summary.refundedInPerson),
                online: money.format(summary.refundedOnline),
              })}
            </dd>
            {earlierTotal !== undefined && (
              <dd className={styles.tileCompare}>
                {t('adminRefunds.summary.before', {
                  days:
                    span === 1
                      ? t('adminRefunds.summary.yesterday')
                      : t('adminRefunds.summary.daysBefore', { count: span }),
                  amount: money.format(earlierTotal),
                })}
              </dd>
            )}
          </div>
          <div className={styles.tile}>
            <dt className={styles.tileLabel}>
              <Icon name="x" size="xs" />
              {t('adminRefunds.summary.cancelled')}
            </dt>
            <dd className={styles.tileValue}>{summary.cancelled}</dd>
            <dd className={styles.tileSub}>
              {t('adminRefunds.summary.cancelledSub', {
                amount: money.format(summary.cancelledValue),
              })}
            </dd>
          </div>
          <div className={cx(styles.tile, pending.length > 0 && styles.tileWarn)}>
            <dt className={styles.tileLabel}>
              <Icon name="clock" size="xs" />
              {t('adminRefunds.summary.pending')}
            </dt>
            <dd className={styles.tileValue}>{pending.length}</dd>
            <dd className={styles.tileSub}>
              {pending.length > 0
                ? t('adminRefunds.summary.pendingSub', {
                    amount: money.format(pendingAmount),
                  })
                : t('adminRefunds.summary.pendingNone')}
            </dd>
            {lateCount > 0 && (
              <dd className={cx(styles.chip, styles.late)}>
                {t('adminRefunds.summary.pendingLate', { count: lateCount })}
              </dd>
            )}
          </div>
        </dl>

        {pending.length > 0 && (
          <section className={cx(styles.card, styles.waiting)} aria-labelledby="refunds-pending">
            <h2 id="refunds-pending" className={styles.cardTitle}>
              <Icon name="clock" size="sm" />
              {t('adminRefunds.pending.title')}
            </h2>
            <p className={styles.muted}>{t('adminRefunds.pending.body')}</p>
            <ul className={styles.rows}>
              {pending.map((e) => (
                <li key={e.key} className={cx(styles.row, late(e) && styles.lateRow)}>
                  <span className={styles.rowMain}>
                    <button
                      type="button"
                      className={styles.orderLink}
                      onClick={() => void openOrder(e.order.id)}
                    >
                      {t('adminPayments.collect.orderLine', {
                        order: e.order.id,
                        name: e.order.customerName,
                      })}
                    </button>
                    {late(e) && (
                      <span className={styles.lateLine}>
                        <span className={cx(styles.chip, styles.late)}>
                          {t('adminRefunds.pending.late')}
                        </span>
                        <span className={styles.muted}>{t('adminRefunds.pending.lateHint')}</span>
                      </span>
                    )}
                    <span className={styles.muted}>
                      {[
                        clock.dateTime(e.at),
                        e.kind === 'refund' && methodName(e.transaction.method),
                        e.reason && reasonLabel('refund', e.reason),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <strong>{money.format(e.amount)}</strong>
                    {can('refunds.give') && (
                      <Button
                        size="sm"
                        iconStart="check"
                        loading={received.isPending && received.variables?.orderId === e.order.id}
                        onClick={() => markReceived(e)}
                      >
                        {t('adminRefunds.pending.received')}
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {reasons.length > 0 && (
          <section className={styles.card} aria-labelledby="refunds-reasons">
            <div className={styles.cardHead}>
              <h2 id="refunds-reasons" className={styles.cardTitle}>
                {t('adminRefunds.reasons.title')}
              </h2>
              <p className={styles.muted}>{t('adminRefunds.reasons.hint')}</p>
            </div>
            <ul className={styles.reasonList}>
              {reasons.map((r) => {
                const key = `${r.kind}:${r.reason}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={styles.reason}
                      aria-pressed={filters.reason === key}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          reason: filters.reason === key ? 'all' : key,
                        })
                      }
                    >
                      <span className={styles.reasonHead}>
                        <span className={cx(styles.kind, styles[r.kind])}>
                          {t(`adminRefunds.list.${r.kind}`)}
                        </span>
                        <span className={styles.reasonName}>{reasonLabel(r.kind, r.reason)}</span>
                        <span className={styles.reasonCount}>
                          {t('adminRefunds.reasons.count', { count: r.count })}
                        </span>
                        <strong>{money.format(r.amount)}</strong>
                      </span>
                      <span className={styles.bar} aria-hidden="true">
                        <span
                          className={styles[r.kind]}
                          style={{ width: `${(r.amount / largest) * 100}%` }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className={styles.card} aria-labelledby="refunds-list">
          <h2 id="refunds-list" className={styles.cardTitle}>
            {t('adminRefunds.list.title')}
          </h2>
          <div className={styles.tabs} role="group" aria-label={t('adminRefunds.filters.label')}>
            {(['all', 'refund', 'cancel'] as const).map((k) => (
              <Chip
                key={k}
                pressed={filters.kind === k}
                count={counts[k]}
                onClick={() => setFilters({ ...filters, kind: k })}
              >
                {t(`adminRefunds.filters.${k}`)}
              </Chip>
            ))}
          </div>
          <div className={styles.searchRow}>
            <SearchField
              value={filters.query}
              onChange={(query) => setFilters({ ...filters, query })}
              label={t('adminRefunds.filters.search')}
              placeholder={t('adminRefunds.filters.search')}
            />
            <Button
              size="sm"
              variant="secondary"
              iconStart="sliders"
              aria-expanded={moreFilters}
              onClick={() => setMoreFilters(!moreFilters)}
            >
              {t('adminRefunds.filters.more')}
            </Button>
          </div>
          {moreFilters && (
            <div className={styles.filters}>
              <Select
                id="refunds-reason"
                label={t('adminRefunds.filters.reason')}
                value={filters.reason}
                onChange={(event) => setFilters({ ...filters, reason: event.target.value })}
              >
                <option value="all">{t('adminRefunds.filters.allReasons')}</option>
                {reasons.map((r) => (
                  <option key={`${r.kind}:${r.reason}`} value={`${r.kind}:${r.reason}`}>
                    {t('adminRefunds.reasons.option', {
                      kind: t(`adminRefunds.list.${r.kind}`),
                      reason: reasonLabel(r.kind, r.reason),
                    })}
                  </option>
                ))}
              </Select>
              <Select
                id="refunds-staff"
                label={t('adminRefunds.filters.staff')}
                value={filters.staff}
                onChange={(event) => setFilters({ ...filters, staff: event.target.value })}
              >
                <option value="all">{t('adminRefunds.filters.allStaff')}</option>
                {staff.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {filtered && (
            <button
              type="button"
              className={styles.clear}
              onClick={() => setFilters({ kind: 'all', reason: 'all', staff: 'all', query: '' })}
            >
              {t('adminRefunds.filters.clear')}
            </button>
          )}

          {entries.length === 0 ? (
            <p className={styles.empty}>
              <Icon name="checkc" size="md" />
              {t('adminRefunds.list.none')}
            </p>
          ) : shown.length === 0 ? (
            <p className={styles.muted}>{t('adminRefunds.list.noMatch')}</p>
          ) : (
            byDay.map(({ day, items }) => {
              const givenBack = items.reduce(
                (sum, e) => sum + (e.kind === 'refund' ? e.amount : 0),
                0,
              );
              return (
                <section key={day} className={styles.day} aria-label={day}>
                  <h3 className={styles.dayHead}>
                    <span>{clock.date(`${day}T12:00:00Z`)}</span>
                    {givenBack > 0 && (
                      <span className={styles.muted}>
                        {t('adminRefunds.list.dayTotal', { amount: money.format(givenBack) })}
                      </span>
                    )}
                  </h3>
                  <ul className={styles.rows}>
                    {items.map((e) => (
                      <li key={e.key} className={cx(styles.row, styles.linkRow)}>
                        <button
                          type="button"
                          className={styles.rowButton}
                          title={t('adminRefunds.list.open', { order: e.order.id })}
                          onClick={() => void openOrder(e.order.id)}
                        >
                          <span className={cx(styles.rowIcon, styles[e.kind])} aria-hidden="true">
                            <Icon name={e.kind === 'refund' ? 'refresh' : 'x'} size="xs" />
                          </span>
                          <span className={styles.rowMain}>
                            <strong>
                              {e.kind === 'refund'
                                ? t('adminRefunds.list.refundLine', {
                                    amount: money.format(e.amount),
                                    method: methodName(e.transaction.method),
                                  })
                                : t('adminRefunds.list.cancelLine', {
                                    amount: money.format(e.amount),
                                  })}
                            </strong>
                            <span className={styles.rowOrder}>
                              {t('adminPayments.collect.orderLine', {
                                order: e.order.id,
                                name: e.order.customerName,
                              })}
                            </span>
                            <span className={styles.muted}>
                              {[
                                clock.time(e.at),
                                e.reason && reasonLabel(e.kind, e.reason),
                                e.kind === 'refund'
                                  ? [
                                      e.by && t('adminRefunds.list.by', { name: e.by }),
                                      e.transaction.note,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')
                                  : e.by &&
                                    t(
                                      e.by === 'guest'
                                        ? 'adminRefunds.list.byGuest'
                                        : 'adminRefunds.list.byRestaurant',
                                    ),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          <span className={styles.rowEnd}>
                            {e.kind === 'refund' ? (
                              <span
                                className={cx(
                                  styles.chip,
                                  late(e) ? styles.late : e.pending ? styles.onWay : styles.given,
                                )}
                              >
                                {late(e)
                                  ? t('adminRefunds.list.late')
                                  : e.pending
                                    ? t('adminRefunds.list.onWay')
                                    : t('adminRefunds.list.given')}
                              </span>
                            ) : (
                              <span className={cx(styles.chip, styles.cancelChip)}>
                                {t('adminRefunds.list.cancel')}
                              </span>
                            )}
                            <Icon name="chev" size="xs" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </section>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('adminRefunds.title')}</h1>
          <p className={styles.muted}>{t('adminRefunds.subtitle')}</p>
        </div>
      </header>

      {(can('refunds.give') || can('orders.cancel')) && (
        <div className={styles.actions}>
          {can('refunds.give') && (
            <button
              type="button"
              className={cx(styles.action, styles.actionMain)}
              onClick={() => setOpen({ kind: 'pick', action: 'refund' })}
            >
              <span className={styles.actionIcon} aria-hidden="true">
                <Icon name="refresh" size="sm" />
              </span>
              <span className={styles.actionText}>
                <strong>{t('adminRefunds.actions.refund')}</strong>
                <span>{t('adminRefunds.actions.refundHint')}</span>
              </span>
            </button>
          )}
          {can('orders.cancel') && (
            <button
              type="button"
              className={styles.action}
              onClick={() => setOpen({ kind: 'pick', action: 'cancel' })}
            >
              <span className={cx(styles.actionIcon, styles.cancelIcon)} aria-hidden="true">
                <Icon name="x" size="sm" />
              </span>
              <span className={styles.actionText}>
                <strong>{t('adminRefunds.actions.cancel')}</strong>
                <span>{t('adminRefunds.actions.cancelHint')}</span>
              </span>
            </button>
          )}
        </div>
      )}

      <div className={styles.rangeRow} role="group" aria-label={t('adminRefunds.ranges.label')}>
        {RANGES.map((r) => (
          <Chip key={r} pressed={range === r} onClick={() => setRange(r)}>
            {t(`adminRefunds.ranges.${r}`)}
          </Chip>
        ))}
      </div>
      {range === 'custom' && (
        <DateRangeFilter id="refunds-days" range={custom} today={today} onChange={setCustom} />
      )}
      <p className={styles.countNote}>
        <Icon name="info" size="xs" />
        {t('adminRefunds.countNote')}
      </p>

      {content}

      {open?.kind === 'pick' && (
        <OrderPicker
          kind={open.action}
          today={today}
          onClose={() => setOpen(null)}
          onPick={(order) => setOpen({ kind: open.action, order })}
          {...(open.action === 'cancel' && can('refunds.give')
            ? { onSwitchToRefund: () => setOpen({ kind: 'pick', action: 'refund' }) }
            : {})}
        />
      )}
      {open?.kind === 'refund' && <RefundDialog order={open.order} onClose={() => setOpen(null)} />}
      {open?.kind === 'view' && (
        <OrderDetailDialog order={viewed.data ?? open.order} onClose={() => setOpen(null)} />
      )}
      {openingId && <LoadingSignal />}
      {open?.kind === 'cancel' && (
        <OrderDetailDialog order={open.order} initialView="cancel" onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
