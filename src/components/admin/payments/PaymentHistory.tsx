'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { HistoryTransaction, PaymentHistoryResponse } from '@/api/contracts';
import { api } from '@/api/endpoints';
import { useContent, usePaymentHistory } from '@/api/hooks';
import { Button, Chip, EmptyState, Icon, SearchField } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminToken } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { paymentHistoryPath, paymentsPath } from '@/lib/adminNav';
import type { ChannelFilter, LedgerLine } from '@/lib/adminPayments';
import { PAYMENT_HISTORY_LIMITS, parseDayRange, shiftDay, type DayRange } from '@/lib/dayRange';
import type { WaiveReason } from '@/types/order';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { LedgerRow } from './LedgerRow';
import { MethodBreakdown } from './MethodBreakdown';
import { useLedgerExport } from './paymentsExport';
import { usePaymentText } from './usePaymentText';
import styles from './PaymentsBoard.module.css';
import own from './PaymentHistory.module.css';
import cards from '../HistorySummary.module.css';

const CHANNELS: readonly ChannelFilter[] = ['all', 'online', 'inPerson'];
const VIEWS = ['transactions', 'refunds'] as const;
type View = (typeof VIEWS)[number];
/** Without days in the address: the last week, today included. */
const DEFAULT_DAYS = 7;
const PRESETS = [
  { days: 7, key: 'week' },
  { days: 30, key: 'month' },
  { days: 91, key: 'quarter' },
  { days: 182, key: 'half' },
  { days: 365, key: 'year' },
] as const;

/** A transaction as the rows show it (the order's number, guest, how it's served). */
const toLine = (tx: HistoryTransaction): LedgerLine => ({
  id: tx.id,
  kind: tx.kind,
  amount: tx.amount,
  channel: tx.channel,
  method: tx.method,
  at: tx.at,
  ...(tx.by ? { by: tx.by } : {}),
  ...(tx.transactionRef ? { transactionRef: tx.transactionRef } : {}),
  ...(tx.tip ? { tip: tx.tip } : {}),
  ...(tx.waived ? { waived: tx.waived } : {}),
  ...(tx.waiveReason ? { waiveReason: tx.waiveReason as WaiveReason } : {}),
  ...(tx.reason ? { reason: tx.reason as LedgerLine['reason'] } : {}),
  ...(tx.status ? { status: tx.status } : {}),
  order: {
    id: tx.orderId,
    customerName: tx.customerName,
    mode: tx.mode,
    ...(tx.table !== undefined ? { table: tx.table } : {}),
  },
});

/**
 * /admin/dashboard/payments/history/: the branch's money over the days picked, on a page of its
 * own (today's Payments stays about today). Quick ranges (7 days to a year) or any From–To up to
 * a year, back two years. The totals are summed on the server, so a year is exact: net takings,
 * online and in person, tips, refunds, by payment method; then every payment and refund, newest
 * first, 50 at a time, searchable and filtered (the filters narrow the list, not the totals),
 * with an Excel export of all of them. Each payment counts on the day it was taken.
 */
export function PaymentHistory() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock } = useAdminWorkspace();
  const token = useAdminToken();
  const { showToast } = useToast();
  const text = usePaymentText();
  const exportLedger = useLedgerExport();
  const now = useNow(60_000);
  const today = clock.dayKey(now ?? new Date());
  const fromParam = useQueryParam('from');
  const toParam = useQueryParam('to');
  const days: DayRange =
    fromParam || toParam
      ? parseDayRange(fromParam, toParam, today, PAYMENT_HISTORY_LIMITS)
      : { from: shiftDay(today, -(DEFAULT_DAYS - 1)), to: today };
  const view: View = useQueryParam('view') === 'refunds' ? 'refunds' : 'transactions';
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [method, setMethod] = useState('all');
  const [exporting, setExporting] = useState(false);

  // Searching waits for a pause in typing (each search asks the server).
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(typed.trim()), 300);
    return () => window.clearTimeout(id);
  }, [typed]);

  const query = {
    from: days.from,
    to: days.to,
    kind: view === 'refunds' ? ('refunds' as const) : ('all' as const),
    channel,
    ...(method !== 'all' ? { method } : {}),
    ...(search ? { q: search } : {}),
  };
  const history = usePaymentHistory(branch.id, query);
  const pages = history.data?.pages ?? [];
  const first: PaymentHistoryResponse | undefined = pages[0];
  const lines = pages.flatMap((p) => p.transactions).map(toLine);

  const goTo = (range: DayRange, next: View = view) =>
    router.replace(paymentHistoryPath(range, next), { scroll: false });
  const dayLabel = (key: string) => clock.date(`${key}T12:00:00Z`);
  const period =
    days.from === days.to
      ? t('adminPayments.history.period.day', { date: dayLabel(days.from) })
      : t('adminPayments.history.period.range', {
          from: dayLabel(days.from),
          to: dayLabel(days.to),
        });

  /** Every matching transaction, a thousand at a time, into one Excel file. */
  const exportAll = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const all: HistoryTransaction[] = [];
      let cursor: string | undefined;
      do {
        const page = await api.paymentHistory(token, branch.id, {
          ...query,
          limit: 1000,
          ...(cursor ? { cursor } : {}),
        });
        all.push(...page.transactions);
        cursor = page.next;
      } while (cursor);
      exportLedger(all.map(toLine), days.from === days.to ? days.from : `${days.from}_${days.to}`);
    } catch {
      showToast(t('adminPayments.failed'), { tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  let content;
  if (first) {
    const { summary } = first;
    const paid = summary.online + summary.inPerson;
    const onlineShare = paid > 0 ? (summary.online / paid) * 100 : 0;
    const methods = summary.byMethod
      .filter((m) => m.count > 0)
      .map((m) => m.method)
      .filter((m, i, all) => all.indexOf(m) === i);
    const filtered = search !== '' || method !== 'all' || channel !== 'all';

    content = (
      <>
        <section className={own.summary} aria-labelledby="history-net">
          <div className={cards.hero}>
            <p className={cards.eyebrow}>{period}</p>
            <h2 id="history-net" className={cards.heroLabel}>
              {t('adminPayments.history.net')}
            </h2>
            <p className={cards.bigValue}>{text.amount(summary.net)}</p>
            <p className={cards.heroHint}>
              {t('adminPayments.history.netHint', {
                collected: text.amount(summary.collected),
                refunds: text.amount(summary.refunds),
              })}
              {' · '}
              {t.plural('adminPayments.history.payments', summary.payments)}
            </p>
            <div className={own.bar} aria-hidden="true">
              <span style={{ width: `${onlineShare}%` }} />
            </div>
            <div className={own.split}>
              <span>
                <i className={own.dotOnline} /> {t('adminPayments.history.online')}{' '}
                <b>{text.amount(summary.online)}</b>
              </span>
              <span>
                <i className={own.dotInPerson} /> {t('adminPayments.history.inPerson')}{' '}
                <b>{text.amount(summary.inPerson)}</b>
              </span>
            </div>
            <div className={cards.heroActions}>
              <Button
                variant="secondary"
                size="sm"
                iconStart="list"
                loading={exporting}
                onClick={() => void exportAll()}
              >
                {exporting
                  ? t('adminPayments.history.exporting')
                  : t('adminPayments.history.export')}
              </Button>
            </div>
          </div>
          <div className={own.kpis}>
            <div className={cards.kpi}>
              <span className={cards.kpiLabel}>
                <Icon name="heart" size="xs" />
                {t('adminPayments.history.tips')}
              </span>
              <span className={cards.kpiValue}>{text.amount(summary.tips)}</span>
            </div>
            <div className={cards.kpi}>
              <span className={cards.kpiLabel}>
                <Icon name="refresh" size="xs" />
                {t('adminPayments.history.refunds')}
              </span>
              <span className={cards.kpiValue}>{text.amount(summary.refunds)}</span>
              {summary.refundsPending > 0 && (
                <span className={cards.kpiHint}>
                  {t('adminPayments.history.refundsHint', {
                    pending: text.amount(summary.refundsPending),
                  })}
                </span>
              )}
            </div>
          </div>
        </section>
        <p className={cards.note}>
          <Icon name="info" size="xs" />
          {t('adminPayments.history.countedNote')}
        </p>

        <div className={styles.columns}>
          <section className={styles.panel} aria-label={t(`adminPayments.history.views.${view}`)}>
            <div
              className={styles.views}
              role="group"
              aria-label={t('adminPayments.history.views.label')}
            >
              {VIEWS.map((v) => (
                <Chip
                  key={v}
                  pressed={view === v}
                  count={
                    v === 'refunds' ? summary.refundCount : summary.payments + summary.refundCount
                  }
                  onClick={() => goTo(days, v)}
                >
                  {t(`adminPayments.history.views.${v}`)}
                </Chip>
              ))}
            </div>
            <div className={styles.tools}>
              <SearchField
                value={typed}
                onChange={setTyped}
                label={t('adminPayments.search.ledger')}
                placeholder={t('adminPayments.search.ledger')}
              />
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
            </div>
            <div className={styles.body}>
              {lines.length > 0 ? (
                <>
                  <ul className={styles.ledger}>
                    {lines.map((line) => (
                      <LedgerRow key={line.id} entry={line} />
                    ))}
                  </ul>
                  <div className={own.more}>
                    <span className="t-small c3">
                      {t('adminPayments.history.showing', {
                        shown: lines.length,
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
                        {t('adminPayments.history.more')}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={filtered ? 'search' : view === 'refunds' ? 'refresh' : 'receipt'}
                  tone="neutral"
                  title={
                    filtered
                      ? t('adminPayments.empty.searchTitle')
                      : view === 'refunds'
                        ? t('adminPayments.empty.refundsTitle')
                        : t('adminPayments.empty.transactionsTitle')
                  }
                  className={styles.state}
                >
                  {search
                    ? t('adminPayments.empty.search', { query: search })
                    : view === 'refunds'
                      ? t('adminPayments.empty.refunds')
                      : t('adminPayments.empty.transactions')}
                </EmptyState>
              )}
            </div>
          </section>
          <aside className={styles.side}>
            <MethodBreakdown
              day={{ byMethod: summary.byMethod, cashInDrawer: summary.cashTaken }}
              live={days.to === today}
            />
          </aside>
        </div>
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
        aria-label={t('adminPayments.history.loading')}
      >
        <span />
        <span />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.historyHead}>
        <Link href={paymentsPath()} className={styles.back}>
          <Icon name="back" size="sm" />
          {t('adminPayments.history.back')}
        </Link>
        <h1 className={styles.historyTitle}>{t('adminPayments.history.title')}</h1>
        <p className="t-small c2">{t('adminPayments.history.subtitle')}</p>
      </div>
      <DateRangeFilter
        id="payment-history-days"
        range={days}
        today={today}
        limits={PAYMENT_HISTORY_LIMITS}
        presets={PRESETS.map((p) => ({
          days: p.days,
          label: t(`adminPayments.history.presets.${p.key}`),
        }))}
        onChange={(range) => goTo(range)}
      />
      {content}
    </div>
  );
}
