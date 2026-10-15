'use client';

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
  ledgerCsv,
  ledgerEntries,
  parsePaymentsView,
  type ChannelFilter,
  type LedgerEntry,
} from '@/lib/adminPayments';
import type { Order } from '@/types/order';
import type { BillRequest } from '@/types/service';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { CollectDialog, type CollectTarget } from './CollectDialog';
import { DueCard } from './DueCard';
import { LedgerRow } from './LedgerRow';
import { MethodBreakdown } from './MethodBreakdown';
import { PaymentOrderDialog } from './PaymentOrderDialog';
import { usePaymentPrint } from './PaymentPrint';
import { RefundDialog } from './RefundDialog';
import { TakingsSummary } from './TakingsSummary';
import { usePaymentText } from './usePaymentText';
import styles from './PaymentsBoard.module.css';

/** Ages ("4 min ago") move on this often. */
const AGE_REFRESH_MS = 20_000;

/** The collect dialog follows the latest data: an order by id, a table by number. */
type CollectKey = { kind: 'order'; id: string } | { kind: 'table'; table: number };

const CHANNELS: readonly ChannelFilter[] = ['all', 'online', 'inPerson'];

/**
 * /admin/dashboard/payments/: the branch's money today, for every member of staff. Today's
 * takings (net, online and in person, to collect, tips, average bill, refunds) with the day
 * report and a CSV export; by payment method with the cash in the drawer; and three views (in
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
  const orders = useBranchOrders(branch.id);
  const service = useBranchService(branch.id);
  const text = usePaymentText();
  const view = parsePaymentsView(useQueryParam('view'));
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [method, setMethod] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [collectKey, setCollectKey] = useState<CollectKey | null>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const now = useNow(AGE_REFRESH_MS);
  const print = usePaymentPrint();

  const goTo = (next: (typeof PAYMENTS_VIEWS)[number]) =>
    router.replace(paymentsPath(next), { scroll: false });

  let content;
  if (orders.data) {
    const all = orders.data.orders;
    const day = daySummary(all);
    const billRequests = (service.data?.requests ?? []).filter(
      (r): r is BillRequest => r.kind === 'bill',
    );
    const groups = dueGroups(all, billRequests);
    const entries = ledgerEntries(all);
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

    const exportCsv = () => {
      const c = (key: Parameters<typeof t>[0]) => t(key);
      const csv = ledgerCsv(
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
          c('adminPayments.report.columns.by'),
          c('adminPayments.report.columns.ref'),
          c('adminPayments.report.columns.reason'),
          c('adminPayments.report.columns.status'),
        ],
        (e: LedgerEntry) => [
          `${clock.date(e.at)} ${clock.time(e.at)}`,
          e.order.id,
          text.where(e.order),
          e.order.customerName,
          t(e.kind === 'refund' ? 'adminPayments.entry.refund' : 'adminPayments.entry.payment'),
          text.methodName(e.method),
          t(e.channel === 'online' ? 'adminPayments.entry.online' : 'adminPayments.entry.inPerson'),
          e.kind === 'refund' ? -e.amount : e.amount,
          e.tip ?? '',
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
      // A byte-order mark so spreadsheets read the currency symbols right.
      const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = t('adminPayments.actions.exportFile', {
        branch: branch.id,
        date: clock.dayKey(now ?? new Date(orders.data.generatedAt)),
      });
      link.click();
      URL.revokeObjectURL(url);
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
          date={clock.date(now ?? new Date(orders.data.generatedAt))}
          onCollect={() => goTo('collect')}
          onReport={() => print.report(all, groups)}
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
            <MethodBreakdown day={day} />
          </aside>
        </div>

        <PaymentOrderDialog
          order={byId(openId)}
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
        <CollectDialog
          target={collectTarget}
          onClose={() => setCollectKey(null)}
          onPrint={(target) => print.bill(ordersOf(target))}
        />
        <RefundDialog order={refundOrder} onClose={() => setRefundId(null)} />
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
