'use client';

import dynamic from 'next/dynamic';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  useBranchOrder,
  useBranchOrders,
  useBranchService,
  useContent,
  useTodayPayments,
} from '@/api/hooks';
import { useToast } from '@/context/ToastContext';
import { Button, Chip, EmptyState, Icon, SearchField } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { paymentHistoryPath, paymentsPath } from '@/lib/adminNav';
import { dueOn } from '@/lib/adminOrders';
import {
  PAYMENTS_VIEWS,
  dueGroups,
  dueSections,
  filterEntries,
  filterGroups,
  parsePaymentsView,
  type ChannelFilter,
  type DueGroup,
} from '@/lib/adminPayments';
import type { Order } from '@/types/order';
import type { BillRequest } from '@/types/service';
import { ordersFilter, shiftDay } from '@/lib/dayRange';
import { HistoryButton } from '../HistoryButton';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import type { CollectTarget } from './CollectDialog';
import { DueCard } from './DueCard';
import { toLine, useAllPayments } from './historyLines';
import { LedgerRow } from './LedgerRow';
import { MethodBreakdown } from './MethodBreakdown';
import { useLedgerExport } from './paymentsExport';
import { usePaymentPrint } from './PaymentPrint';
import { TodayStrip } from './TodayStrip';
import { useMethodLabels, usePaymentText } from './usePaymentText';
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

/** The collect dialog follows the latest data: an order by id, a table by number. */
type CollectKey = { kind: 'order'; id: string } | { kind: 'table'; table: number };

const CHANNELS: readonly ChannelFilter[] = ['all', 'online', 'inPerson'];
const NO_METHODS: readonly { method: string; channel: 'online' | 'inPerson' }[] = [];

/** Today's payments and refunds read at once (a busy day is a few hundred). */
const TODAY_PAGE = 500;

/**
 * /admin/dashboard/payments/: the branch's money today, live, for every member of staff
 * (earlier days are on Payments › History). Today's money counts each payment when it was
 * taken, whatever day the order was placed: To collect (every bill still open) and Taken today,
 * with the day report and an Excel export; by payment method with the cash taken; and three
 * views (in the address): To collect (bills asked for, today's, from earlier days: collect in
 * full, split or part, with tip and change, or print the bill), Transactions (every payment and
 * refund today, by channel and method, searchable) and Refunds. Each order opens with its
 * payments, to collect, refund or print a receipt. Read from GET …/orders (bills), …/payments
 * (today's money) and the service's bill requests: polled every 15 s, and at once on a payment,
 * a refund or the branch's live events.
 */
export function PaymentsBoard() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock } = useAdminWorkspace();
  const now = useNow(AGE_REFRESH_MS);
  const today = clock.dayKey(now ?? new Date());
  // Today only: earlier days are on Payments › History.
  const days = { from: today, to: today };
  const live = true;
  // Up to today, every bill still to pay however old: nothing unpaid drops off To collect.
  const orders = useBranchOrders(
    branch.id,
    { ...ordersFilter(days, today), ...(live ? { due: 'all' as const } : {}) },
    live,
  );
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
  const exportLedger = useLedgerExport();
  const allPayments = useAllPayments();
  const { showToast } = useToast();
  // Today's money as it's taken: the totals and every payment and refund (filtered here, so the
  // day report always has the whole day). A busy day fits in one page; more load on request.
  const money = useTodayPayments(branch.id, { from: today, to: today, limit: TODAY_PAGE });
  // Two methods with one name (UPI in person and online) say which is which.
  const methodLabel = useMethodLabels(money.data?.pages[0]?.summary.byMethod ?? NO_METHODS);
  const moneyPages = money.data?.pages ?? [];
  const lines = moneyPages.flatMap((p) => p.transactions).map(toLine);
  // An order the lists don't hold (paid today, placed days ago), read when it's opened.
  const loaded = orders.data?.orders ?? [];
  const wanted = openId ?? refundId;
  const looked = useBranchOrder(
    branch.id,
    wanted && !loaded.some((o) => o.id === wanted) ? wanted : null,
  );

  const goTo = (next: (typeof PAYMENTS_VIEWS)[number]) =>
    router.replace(paymentsPath(next), { scroll: false });
  /** Today, as the summary's heading and the report write it. */
  const period = t('adminPayments.today.eyebrow', { date: clock.date(now ?? new Date()) });

  const history = (
    <HistoryButton href={paymentHistoryPath()} label={t('adminPayments.historyButton')} />
  );

  let content;
  const summary = moneyPages[0]?.summary;
  if (orders.data && summary) {
    // Every bill still to pay, however old; today's money is the server's, as it was taken.
    const all = orders.data.orders;
    const billRequests = live
      ? (service.data?.requests ?? []).filter((r): r is BillRequest => r.kind === 'bill')
      : [];
    // A table's bill is today's and yesterday's orders there (as the server takes it, a bill
    // left open at midnight included); older ones are collected on their own.
    const tableFrom = shiftDay(today, -1);
    const groups = dueGroups(all, billRequests, (o) => clock.dayKey(o.placedAt) >= tableFrom);
    const refunds = lines.filter((e) => e.kind === 'refund');
    const shownGroups = filterGroups(groups, query);
    // Bills opened before today: to chase up, kept apart (and in To collect's total).
    const isEarlier = (since: string) => clock.dayKey(since) < today;
    const due = dueSections(groups, isEarlier);
    const shown = dueSections(shownGroups, isEarlier);
    const filters = { method, channel, query };
    const shownEntries = filterEntries(view === 'refunds' ? refunds : lines, filters);
    const counts = {
      collect: groups.length,
      transactions: summary.payments + summary.refundCount,
      refunds: summary.refundCount,
    };
    const methods = summary.byMethod.filter((m) => m.count > 0).map((m) => m.method);
    const byId = (id: string | null) =>
      id
        ? (all.find((o) => o.id === id) ?? (looked.data?.id === id ? looked.data : undefined))
        : undefined;

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

    // The whole day into Excel (all of it, even past what's loaded).
    const exportCsv = async () => {
      try {
        exportLedger(await allPayments(branch.id, { from: today, to: today }), today);
      } catch {
        showToast(t('adminPayments.failed'), { tone: 'error' });
      }
    };

    const ordersOf = (target: CollectTarget): Order[] =>
      target.kind === 'order' ? [target.order] : target.orders;

    let list;
    const dueRow = (group: DueGroup, earlier = false) => (
      <DueCard
        key={group.key}
        group={group}
        now={now}
        earlier={earlier}
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
    );
    const dueSection = (
      key: 'asked' | 'today' | 'earlier',
      groupsIn: readonly DueGroup[],
      total?: number,
    ) =>
      groupsIn.length > 0 && (
        <section key={key} className={styles.dueSection} aria-labelledby={`due-${key}`}>
          <header className={styles.dueHead} data-tone={key}>
            <h3 id={`due-${key}`} className={styles.dueTitle}>
              {key === 'asked' && <Icon name="bell" size="xs" />}
              {key === 'earlier' && <Icon name="clock" size="xs" />}
              {t(`adminPayments.sections.${key}`)}
              <span className={styles.dueCount}>{groupsIn.length}</span>
            </h3>
            {total !== undefined && <span className={styles.dueTotal}>{text.amount(total)}</span>}
            {key === 'earlier' && (
              <p className={styles.dueHint}>{t('adminPayments.sections.earlierHint')}</p>
            )}
          </header>
          <ul className={styles.dueList}>{groupsIn.map((g) => dueRow(g, key === 'earlier'))}</ul>
        </section>
      );

    if (view === 'collect') {
      list =
        shownGroups.length > 0 ? (
          <div className={styles.dueSections}>
            {dueSection('asked', shown.asked)}
            {dueSection('today', shown.today)}
            {dueSection('earlier', shown.earlier, shown.earlierTotal)}
          </div>
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
          <>
            <ul className={styles.ledger}>
              {shownEntries.map((entry) => (
                <LedgerRow key={entry.id} entry={entry} onOpen={() => setOpenId(entry.order.id)} />
              ))}
            </ul>
            {money.hasNextPage && (
              <div className={styles.more}>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={money.isFetchingNextPage}
                  onClick={() => void money.fetchNextPage()}
                >
                  {t('adminPayments.history.more')}
                </Button>
              </div>
            )}
          </>
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
        <TodayStrip
          day={summary}
          due={due}
          bills={groups.length}
          period={period}
          onCollect={() => goTo('collect')}
          onReport={() => print.report(summary, lines, groups, period)}
          onExport={() => void exportCsv()}
        />

        <div className={styles.columns}>
          <section className={styles.panel} aria-label={t(`adminPayments.views.${view}`)}>
            <div className={styles.viewsRow}>
              <div
                className={styles.views}
                role="group"
                aria-label={t('adminPayments.views.label')}
              >
                {PAYMENTS_VIEWS.map((v) => (
                  <Chip key={v} pressed={view === v} count={counts[v]} onClick={() => goTo(v)}>
                    {t(`adminPayments.views.${v}`)}
                  </Chip>
                ))}
              </div>
              {history}
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
                          {methodLabel(m)}
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
                    amount: text.amount(summary.refunds),
                    pending: text.amount(summary.refundsPending),
                  })}
                </p>
              )}
            </div>
            <div className={styles.body}>{list}</div>
          </section>

          <aside className={styles.side}>
            <MethodBreakdown
              day={{ byMethod: summary.byMethod, cashInDrawer: summary.cashTaken }}
              live={live}
            />
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
  } else if (orders.isError || money.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminHome.error.title')}
        className={styles.state}
        actions={
          <Button
            iconStart="refresh"
            loading={orders.isFetching || money.isFetching}
            onClick={() => {
              void orders.refetch();
              void money.refetch();
            }}
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
      {/* Until the views show, History waits on its own row, so it's always reachable. */}
      {!orders.data && <div className={styles.toolbar}>{history}</div>}
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
