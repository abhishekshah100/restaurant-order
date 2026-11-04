'use client';

import { useState } from 'react';
import { useBranchOrders, useContent } from '@/api/hooks';
import { useRefundReceived } from '@/api/mutations';
import { Button, Icon, Input, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useNow } from '@/hooks/useNow';
import { cx } from '@/lib/cx';
import { ordersFilter, shiftDay, type DayRange } from '@/lib/dayRange';
import {
  filterRefunds,
  reasonTotals,
  refundStaff,
  refundsEntries,
  refundsSummary,
  type RefundsEntry,
  type RefundsFilters,
} from '@/lib/refundsReport';
import { DateRangeFilter } from '../DateRangeFilter';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './RefundsPage.module.css';

/** The days shown at first: the last week. */
const DEFAULT_DAYS = 7;

/**
 * /admin/dashboard/refunds/: every refund and cancellation on the orders placed in the days
 * chosen. What they come to (refunded in person and online, cancelled orders), the online
 * refunds still on their way (marked received when the guest has them), the reasons, and the
 * list, filtered by kind, reason, who gave it and order.
 */
export function RefundsPage() {
  const t = useContent('common');
  const { branch, clock, money, can } = useAdminWorkspace();
  const { methodName } = usePaymentText();
  const { showToast } = useToast();
  const now = useNow();
  const today = clock.dayKey(now ?? new Date());
  const [days, setDays] = useState<DayRange>({
    from: shiftDay(today, -(DEFAULT_DAYS - 1)),
    to: today,
  });
  const [filters, setFilters] = useState<RefundsFilters>({
    kind: 'all',
    reason: 'all',
    staff: 'all',
    query: '',
  });
  const orders = useBranchOrders(branch.id, ordersFilter(days, today), days.to === today);
  const received = useRefundReceived();

  const reasonLabel = (kind: RefundsEntry['kind'], reason: string) =>
    !reason
      ? t('adminRefunds.reasons.none')
      : kind === 'refund'
        ? t(`adminPayments.entry.reasons.${reason as 'complaint'}`)
        : reason;

  let content;
  if (orders.isError) {
    content = (
      <div className={styles.card}>
        <p>{t('adminRefunds.failed')}</p>
        <Button variant="secondary" onClick={() => void orders.refetch()}>
          {t('adminRefunds.retry')}
        </Button>
      </div>
    );
  } else if (!orders.data) {
    content = (
      <p className={styles.muted} aria-busy="true">
        {t('adminRefunds.loading')}
      </p>
    );
  } else {
    const entries = refundsEntries(orders.data.orders);
    const summary = refundsSummary(entries);
    const reasons = reasonTotals(entries);
    const staff = refundStaff(entries);
    const pending = entries.filter((e) => e.kind === 'refund' && e.pending);
    const shown = filterRefunds(entries, filters);
    const markReceived = (e: RefundsEntry) =>
      e.kind === 'refund' &&
      received.mutate(
        { branchId: branch.id, orderId: e.order.id, seq: e.seq },
        {
          onSuccess: () =>
            showToast(t('adminRefunds.pending.receivedToast', { order: e.order.id }), {
              tone: 'success',
            }),
          onError: () => showToast(t('adminRefunds.pending.failed'), { tone: 'error' }),
        },
      );

    content = (
      <>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>{t('adminRefunds.summary.refunded')}</span>
            <strong className={styles.tileValue}>{money.format(summary.refunded)}</strong>
            <span className={styles.muted}>
              {t('adminRefunds.summary.refundedSub', {
                inPerson: money.format(summary.refundedInPerson),
                online: money.format(summary.refundedOnline),
              })}
            </span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>{t('adminRefunds.summary.cancelled')}</span>
            <strong className={styles.tileValue}>{summary.cancelled}</strong>
            <span className={styles.muted}>
              {t('adminRefunds.summary.cancelledSub', {
                amount: money.format(summary.cancelledValue),
              })}
            </span>
          </div>
          <div className={cx(styles.tile, summary.pending > 0 && styles.tileWarn)}>
            <span className={styles.tileLabel}>{t('adminRefunds.summary.pending')}</span>
            <strong className={styles.tileValue}>{summary.pending}</strong>
            <span className={styles.muted}>{money.format(summary.pendingAmount)}</span>
          </div>
        </div>

        {pending.length > 0 && (
          <section className={styles.card} aria-labelledby="refunds-pending">
            <h2 id="refunds-pending" className={styles.cardTitle}>
              {t('adminRefunds.pending.title')}
            </h2>
            <p className={styles.muted}>{t('adminRefunds.pending.body')}</p>
            <ul className={styles.rows}>
              {pending.map((e) => (
                <li key={e.key} className={styles.row}>
                  <span className={styles.rowMain}>
                    <strong>
                      {t('adminPayments.collect.orderLine', {
                        order: e.order.id,
                        name: e.order.customerName,
                      })}
                    </strong>
                    <span className={styles.muted}>
                      {[
                        clock.dateTime(e.at),
                        methodName(e.kind === 'refund' ? e.transaction.method : ''),
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
                        variant="secondary"
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
            <h2 id="refunds-reasons" className={styles.cardTitle}>
              {t('adminRefunds.reasons.title')}
            </h2>
            <ul className={styles.reasonList}>
              {reasons.map((r) => (
                <li key={`${r.kind}:${r.reason}`}>
                  <button
                    type="button"
                    className={styles.reason}
                    aria-pressed={filters.reason === `${r.kind}:${r.reason}`}
                    onClick={() =>
                      setFilters({
                        ...filters,
                        reason:
                          filters.reason === `${r.kind}:${r.reason}`
                            ? 'all'
                            : `${r.kind}:${r.reason}`,
                      })
                    }
                  >
                    <span className={cx(styles.kind, styles[r.kind])}>
                      {t(`adminRefunds.list.${r.kind}`)}
                    </span>
                    <span className={styles.reasonName}>{reasonLabel(r.kind, r.reason)}</span>
                    <span className={styles.muted}>
                      {t('adminRefunds.reasons.count', { count: r.count })}
                    </span>
                    <strong>{money.format(r.amount)}</strong>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.card} aria-labelledby="refunds-list">
          <h2 id="refunds-list" className={styles.cardTitle}>
            {t('adminRefunds.list.title')}
          </h2>
          <div className={styles.filters}>
            <Select
              id="refunds-kind"
              label={t('adminRefunds.filters.kind')}
              value={filters.kind}
              onChange={(event) =>
                setFilters({ ...filters, kind: event.target.value as RefundsFilters['kind'] })
              }
            >
              <option value="all">{t('adminRefunds.filters.all')}</option>
              <option value="refund">{t('adminRefunds.filters.refund')}</option>
              <option value="cancel">{t('adminRefunds.filters.cancel')}</option>
            </Select>
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
            <Input
              id="refunds-search"
              label={t('adminRefunds.filters.search')}
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            />
          </div>
          {entries.length === 0 ? (
            <p className={styles.muted}>{t('adminRefunds.list.none')}</p>
          ) : shown.length === 0 ? (
            <p className={styles.muted}>{t('adminRefunds.list.noMatch')}</p>
          ) : (
            <ul className={styles.rows}>
              {shown.map((e) => (
                <li key={e.key} className={styles.row}>
                  <span className={cx(styles.rowIcon, styles[e.kind])} aria-hidden="true">
                    <Icon name={e.kind === 'refund' ? 'refresh' : 'x'} size="xs" />
                  </span>
                  <span className={styles.rowMain}>
                    <strong>
                      {[
                        t(`adminRefunds.list.${e.kind}`),
                        t('adminPayments.collect.orderLine', {
                          order: e.order.id,
                          name: e.order.customerName,
                        }),
                      ].join(' · ')}
                    </strong>
                    <span className={styles.muted}>
                      {[
                        clock.dateTime(e.at),
                        e.reason && reasonLabel(e.kind, e.reason),
                        e.kind === 'refund'
                          ? [
                              methodName(e.transaction.method),
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
                    <strong>{money.format(e.kind === 'refund' ? -e.amount : e.amount)}</strong>
                    {e.kind === 'refund' && e.transaction.channel === 'online' && (
                      <span className={cx(styles.chip, e.pending ? styles.waiting : styles.done)}>
                        {e.pending
                          ? t('adminPayments.entry.refundStarted')
                          : t('adminPayments.entry.refundDone')}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className={styles.muted}>{t('adminRefunds.note')}</p>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('adminRefunds.title')}</h1>
        <p className={styles.muted}>{t('adminRefunds.subtitle')}</p>
      </header>
      <DateRangeFilter id="refunds-days" range={days} today={today} onChange={setDays} />
      {content}
    </div>
  );
}
