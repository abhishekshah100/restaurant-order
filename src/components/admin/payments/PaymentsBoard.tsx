'use client';

import dynamic from 'next/dynamic';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBranchOrders, useBranchService, useContent } from '@/api/hooks';
import { Button, Chip, EmptyState, Icon, SearchField } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { paymentsPath } from '@/lib/adminNav';
import { dueOn } from '@/lib/adminOrders';
import {
  PAYMENTS_VIEWS,
  daySummary,
  dueGroups,
  filterEntries,
  filterGroups,
  ledgerEntries,
  parsePaymentsView,
  type ChannelFilter,
  type LedgerEntry,
} from '@/lib/adminPayments';
import type { Order } from '@/types/order';
import type { BillRequest } from '@/types/service';
import { inDayRange, isTodayOnly, ordersFilter, parseDayRange } from '@/lib/dayRange';
import { downloadXlsx, toXlsx } from '@/lib/xlsx';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import type { CollectTarget } from './CollectDialog';
import { DueCard } from './DueCard';
import { LedgerRow } from './LedgerRow';
import { MethodBreakdown } from './MethodBreakdown';
import { usePaymentPrint } from './PaymentPrint';
import { TakingsSummary } from './TakingsSummary';
import { usePaymentText } from './usePaymentText';
import styles from './PaymentsBoard.module.css';

// Popups: each downloaded the first time it opens.
const CollectDialog = dynamic(() => import('./CollectDialog').then((m) => m.CollectDialog), {
  ssr: false,
  loading: () => <LoadingSignal />,
});
const PaymentOrderDialog = dynamic(
  () => import('./PaymentOrderDialog').then((m) => m.PaymentOrderDialog),
  {
    ssr: false,
    loading: () => <LoadingSignal />,
  },
);
const RefundDialog = dynamic(() => import('./RefundDialog').then((m) => m.RefundDialog), {
  ssr: false,
  loading: () => <LoadingSignal />,
});

/** Ages ("4 min ago") move on this often. */
const AGE_REFRESH_MS = 20_000;

/** A calendar day as the branch writes dates: "2026-10-20" → "20 Oct 2026". */
const dayLabelOf = (date: (at: string) => string) => (key: string) => date(`${key}T12:00:00Z`);

/** The collect dialog follows the latest data: an order by id, a table by number. */
type CollectKey = { kind: 'order'; id: string } | { kind: 'table'; table: number };

const CHANNELS: readonly ChannelFilter[] = ['all', 'online', 'inPerson'];

/**
 * /admin/dashboard/payments/: the branch's money today (or on the days picked, ?from=&to=, up to
 * a year back), for every member of staff. Today's
 * takings (net, online and in person, to collect, tips, average bill, refunds) with the day
 * report and an Excel export; by payment method with the cash in the drawer; and three views (in
 * the address): To collect (open bills by table, bill requests first: collect in full, split or
 * part, with tip and change, or print the bill), Transactions (every payment and refund, by
 * channel and method, searchable) and Refunds. Each order opens with its payments, to collect,
 * refund or print a receipt. Read from GET /admin/branches/:branchId/orders (and the service's
 * bill requests), polled every 15 s.
 */
export function PaymentsBoard() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock } = useAdminWorkspace();
  const now = useNow(AGE_REFRESH_MS);
  const today = clock.dayKey(now ?? new Date());
  const days = parseDayRange(useQueryParam('from'), useQueryParam('to'), today);
  const onToday = isTodayOnly(days, today);
  // Days up to today keep being polled; past ones don't change on their own.
  const live = days.to === today;
  const orders = useBranchOrders(branch.id, ordersFilter(days, today), live);
  const service = useBranchService(branch.id);
  const text = usePaymentText();
  const view = parsePaymentsView(useQueryParam('view'));
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [method, setMethod] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [collectKey, setCollectKey] = useState<CollectKey | null>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const print = usePaymentPrint();
  const dayLabel = dayLabelOf(clock.date);

  const goTo = (next: (typeof PAYMENTS_VIEWS)[number], range = days) =>
    router.replace(paymentsPath(next, isTodayOnly(range, today) ? undefined : range), {
      scroll: false,
    });
  /** The days, as the summary's heading and the report write them. */
  const period = onToday
    ? t('adminPayments.today.eyebrow', { date: clock.date(now ?? new Date()) })
    : days.from === days.to
      ? t('adminPayments.today.eyebrowDay', { date: dayLabel(days.from) })
      : t('adminPayments.today.eyebrowRange', {
          from: dayLabel(days.from),
          to: dayLabel(days.to),
        });

  let content;
  if (orders.data) {
    // Up to today the list also has yesterday's bills still to pay: they're to collect, but
    // their money counts on the day they were placed.
    const all = orders.data.orders;
    const placed = all.filter((o) => inDayRange(clock.dayKey(o.placedAt), days));
    const day = daySummary(placed);
    const billRequests = live
      ? (service.data?.requests ?? []).filter((r): r is BillRequest => r.kind === 'bill')
      : [];
    const groups = dueGroups(all, billRequests);
    const entries = ledgerEntries(placed);
    const refunds = entries.filter((e) => e.kind === 'refund');
    const shownGroups = filterGroups(groups, query);
    const filters = { method, channel, query };
    const shownEntries = filterEntries(view === 'refunds' ? refunds : entries, filters);
    const counts = {
      collect: groups.length,
      transactions: entries.length,
      refunds: refunds.length,
    };
    const methods = [...new Set(entries.map((e) => e.method))];
    const byId = (id: string | null) => (id ? all.find((o) => o.id === id) : undefined);

    // The collect dialog's orders as they are now (it closes once nothing is due).
    let collectTarget: CollectTarget | null = null;
    if (collectKey?.kind === 'order') {
      const order = byId(collectKey.id);
      if (order && dueOn(order) > 0) collectTarget = { kind: 'order', order };
    } else if (collectKey?.kind === 'table') {
      const atTable = all.filter(
        (o) => o.mode === 'dineIn' && o.table === collectKey.table && dueOn(o) > 0,
      );
      if (atTable.length > 0) {
        collectTarget = { kind: 'table', table: collectKey.table, orders: atTable };
      }
    }
    const refundOrder = byId(refundId) ?? null;
    const openOrder = byId(openId);

    const exportCsv = () => {
      const c = (key: Parameters<typeof t>[0]) => t(key);
      const workbook = toXlsx(
        t('adminPayments.title'),
        [...entries].reverse(),
        [
          c('adminPayments.report.columns.time'),
          c('adminPayments.report.columns.order'),
          c('adminPayments.report.columns.where'),
          c('adminPayments.report.columns.guest'),
          c('adminPayments.report.columns.kind'),
          c('adminPayments.report.columns.method'),
          c('adminPayments.report.columns.channel'),
          c('adminPayments.report.columns.amount'),
          c('adminPayments.report.columns.tip'),
          c('adminPayments.report.columns.left'),
          c('adminPayments.report.columns.leftReason'),
          c('adminPayments.report.columns.by'),
          c('adminPayments.report.columns.ref'),
          c('adminPayments.report.columns.reason'),
          c('adminPayments.report.columns.status'),
        ],
        (e: LedgerEntry) => [
          clock.dateTime(e.at),
          e.order.id,
          text.where(e.order),
          e.order.customerName,
          t(e.kind === 'refund' ? 'adminPayments.entry.refund' : 'adminPayments.entry.payment'),
          text.methodName(e.method),
          t(e.channel === 'online' ? 'adminPayments.entry.online' : 'adminPayments.entry.inPerson'),
          e.kind === 'refund' ? -e.amount : e.amount,
          e.tip ?? '',
          e.waived ?? '',
          e.waiveReason ? t(`adminPayments.entry.waiveReasons.${e.waiveReason}`) : '',
          e.by ?? '',
          e.transactionRef ?? '',
          e.reason ? t(`adminPayments.entry.reasons.${e.reason}`) : '',
          e.kind === 'refund'
            ? t(
                e.status === 'started'
                  ? 'adminPayments.entry.refundStarted'
                  : 'adminPayments.entry.refundDone',
              )
            : '',
        ],
      );
      downloadXlsx(
        workbook,
        t('adminPayments.actions.exportFile', {
          branch: branch.id,
          date: onToday ? today : days.from === days.to ? days.from : `${days.from}_${days.to}`,
        }),
      );
    };

    const ordersOf = (target: CollectTarget): Order[] =>
      target.kind === 'order' ? [target.order] : target.orders;

    let list;
    if (view === 'collect') {
      list =
        shownGroups.length > 0 ? (
          <ul className={styles.dueList}>
            {shownGroups.map((group) => (
              <DueCard
                key={group.key}
                group={group}
                now={now}
                onOpenOrder={setOpenId}
                onPrint={() => print.bill(group.kind === 'table' ? group.orders : [group.order])}
                onCollect={() =>
                  setCollectKey(
                    group.kind === 'table' && group.orders.length > 1
                      ? { kind: 'table', table: group.table }
                      : {
                          kind: 'order',
                          id: group.kind === 'table' ? group.orders[0].id : group.order.id,
                        },
                  )
                }
              />
            ))}
          </ul>
        ) : (
          <Empty
            icon={query.trim() ? 'search' : 'checkc'}
            title={
              query.trim()
                ? t('adminPayments.empty.searchTitle')
                : t('adminPayments.empty.collectTitle')
            }
            body={
              query.trim()
                ? t('adminPayments.empty.search', { query: query.trim() })
                : t('adminPayments.empty.collect')
            }
          />
        );
    } else {
      list =
        shownEntries.length > 0 ? (
          <ul className={styles.ledger}>
            {shownEntries.map((entry) => (
              <LedgerRow key={entry.id} entry={entry} onOpen={() => setOpenId(entry.order.id)} />
            ))}
          </ul>
        ) : (
          <Empty
            icon={query.trim() ? 'search' : view === 'refunds' ? 'refresh' : 'receipt'}
            title={
              query.trim() || method !== 'all' || channel !== 'all'
                ? t('adminPayments.empty.searchTitle')
                : view === 'refunds'
                  ? t('adminPayments.empty.refundsTitle')
                  : t('adminPayments.empty.transactionsTitle')
            }
            body={
              query.trim()
                ? t('adminPayments.empty.search', { query: query.trim() })
                : view === 'refunds'
                  ? t('adminPayments.empty.refunds')
                  : t('adminPayments.empty.transactions')
            }
          />
        );
    }

    content = (
      <>
        <TakingsSummary
          day={day}
          period={period}
          onCollect={() => goTo('collect')}
          onReport={() => print.report(placed, groups, period)}
          onExport={exportCsv}
        />

        <div className={styles.columns}>
          <section className={styles.panel} aria-label={t(`adminPayments.views.${view}`)}>
            <div className={styles.views} role="group" aria-label={t('adminPayments.views.label')}>
              {PAYMENTS_VIEWS.map((v) => (
                <Chip key={v} pressed={view === v} count={counts[v]} onClick={() => goTo(v)}>
                  {t(`adminPayments.views.${v}`)}
                </Chip>
              ))}
            </div>
            <div className={styles.tools}>
              <SearchField
                value={query}
                onChange={setQuery}
                label={
                  view === 'collect'
                    ? t('adminPayments.search.collect')
                    : t('adminPayments.search.ledger')
                }
                placeholder={
                  view === 'collect'
                    ? t('adminPayments.search.collect')
                    : t('adminPayments.search.ledger')
                }
              />
              {view !== 'collect' && (
                <div className={styles.filters}>
                  <div
                    className={styles.chips}
                    role="group"
                    aria-label={t('adminPayments.channels.label')}
                  >
                    {CHANNELS.map((c) => (
                      <Chip key={c} pressed={channel === c} onClick={() => setChannel(c)}>
                        {t(`adminPayments.channels.${c}`)}
                      </Chip>
                    ))}
                  </div>
                  {methods.length > 1 && (
                    <div
                      className={styles.chips}
                      role="group"
                      aria-label={t('adminPayments.methodFilter.label')}
                    >
                      <Chip pressed={method === 'all'} onClick={() => setMethod('all')}>
                        {t('adminPayments.methodFilter.all')}
                      </Chip>
                      {methods.map((m) => (
                        <Chip key={m} pressed={method === m} onClick={() => setMethod(m)}>
                          {text.methodName(m)}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {view === 'refunds' && refunds.length > 0 && (
                <p className={styles.refundNote}>
                  <Icon name="info" size="xs" />
                  {t('adminPayments.refundsSummary', {
                    amount: text.amount(day.refunds),
                    pending: text.amount(day.refundsPending),
                  })}
                </p>
              )}
            </div>
            <div className={styles.body}>{list}</div>
          </section>

          <aside className={styles.side}>
            <MethodBreakdown day={day} live={live} />
          </aside>
        </div>

        {openOrder && (
          <PaymentOrderDialog
            order={openOrder}
            onClose={() => setOpenId(null)}
            onCollect={(order) => {
              setOpenId(null);
              setCollectKey({ kind: 'order', id: order.id });
            }}
            onRefund={(order) => {
              setOpenId(null);
              setRefundId(order.id);
            }}
            onPrint={(order) => print.bill([order])}
          />
        )}
        {collectTarget && (
          <CollectDialog
            target={collectTarget}
            onClose={() => setCollectKey(null)}
            onPrint={(target) => print.bill(ordersOf(target))}
          />
        )}
        {refundOrder && <RefundDialog order={refundOrder} onClose={() => setRefundId(null)} />}
        {print.sheet}
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
      <div className={styles.skeleton} role="status" aria-label={t('adminPayments.loading')}>
        <span />
        <span />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* The bar above already names the page; the heading is for screen readers. */}
      <h1 className="visually-hidden">{t('adminPayments.title')}</h1>
      <DateRangeFilter
        id="payments-days"
        range={days}
        today={today}
        onChange={(range) => goTo(view, range)}
      />
      {content}
    </div>
  );
}

function Empty({
  icon,
  title,
  body,
}: {
  icon: 'search' | 'checkc' | 'refresh' | 'receipt';
  title: string;
  body: string;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} data-icon={icon} aria-hidden="true">
        <Icon name={icon} size="md" />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyBody}>{body}</p>
    </div>
  );
}
