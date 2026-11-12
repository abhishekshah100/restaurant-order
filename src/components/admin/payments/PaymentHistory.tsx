'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PaymentHistoryResponse } from '@/api/contracts';
import { useContent, usePaymentHistory } from '@/api/hooks';
import { Button, Chip, EmptyState, Icon, SearchField, Select } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { paymentHistoryPath, paymentsPath } from '@/lib/adminNav';
import type { ChannelFilter } from '@/lib/adminPayments';
import {
  PAYMENT_HISTORY_LIMITS,
  groupByDay,
  parseDayRange,
  shiftDay,
  type DayRange,
} from '@/lib/dayRange';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { toLine, useAllPayments } from './historyLines';
import { LedgerRow } from './LedgerRow';
import { MethodBreakdown } from './MethodBreakdown';
import { useLedgerExport } from './paymentsExport';
import { useMethodLabels, usePaymentText } from './usePaymentText';
import styles from './PaymentsBoard.module.css';
import own from './PaymentHistory.module.css';

const CHANNELS: readonly ChannelFilter[] = ['all', 'online', 'inPerson'];
const NO_METHODS: readonly { method: string; channel: 'online' | 'inPerson' }[] = [];
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

/**
 * /admin/dashboard/payments/history/: the branch's money over the days picked, on a page of its
 * own (today's Payments stays about today). Quick ranges (7 days to a year) or any From–To up to
 * a year, back two years. A light summary the server adds up (exact over a year): net taken,
 * then online, in person, tips, refunds, cash taken; Excel. Then All or Refunds, a search with
 * Paid and Method as two drop-downs (the filters narrow the list, not the totals), and every
 * payment and refund newest first, under its day with the day's count and total, 50 at a time;
 * by payment method beside it (two methods with one name say how they were paid).
 */
export function PaymentHistory() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock } = useAdminWorkspace();
  const { showToast } = useToast();
  const text = usePaymentText();
  const exportLedger = useLedgerExport();
  const allPayments = useAllPayments();
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
  const methodLabel = useMethodLabels(first?.summary.byMethod ?? NO_METHODS);

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
    setExporting(true);
    try {
      const all = await allPayments(branch.id, query);
      exportLedger(all, days.from === days.to ? days.from : `${days.from}_${days.to}`);
    } catch {
      showToast(t('adminPayments.failed'), { tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  let content;
  if (first) {
    const { summary } = first;
    const methods = summary.byMethod
      .filter((m) => m.count > 0)
      .map((m) => m.method)
      .filter((m, i, all) => all.indexOf(m) === i);
    const filtered = search !== '' || method !== 'all' || channel !== 'all';
    const clear = () => {
      setTyped('');
      setSearch('');
      setChannel('all');
      setMethod('all');
    };
    const small: { key: string; label: string; value: string; tone?: string }[] = [
      {
        key: 'online',
        label: t('adminPayments.history.online'),
        value: text.amount(summary.online),
      },
      {
        key: 'inPerson',
        label: t('adminPayments.history.inPerson'),
        value: text.amount(summary.inPerson),
      },
      { key: 'tips', label: t('adminPayments.history.tips'), value: text.amount(summary.tips) },
      {
        key: 'refunds',
        label: t('adminPayments.history.refunds'),
        value: text.amount(summary.refunds),
        tone: summary.refunds > 0 ? own.refunds : undefined,
      },
      ...(summary.waived > 0
        ? [
            {
              key: 'left',
              label: t('adminPayments.history.left'),
              value: text.amount(summary.waived),
            },
          ]
        : []),
      {
        key: 'cash',
        label: t('adminPayments.history.cash'),
        value: text.amount(summary.cashTaken),
      },
    ];
    // Newest first, each day under its heading with what's listed that day.
    const byDay = groupByDay(lines, (l) => clock.dayKey(l.at));

    content = (
      <>
        <section className={own.summary} aria-labelledby="history-net">
          <div className={own.summaryHead}>
            <p className={own.period}>{period}</p>
            <Button
              variant="secondary"
              size="sm"
              iconStart="list"
              loading={exporting}
              aria-label={t('adminPayments.history.exportLabel')}
              onClick={() => void exportAll()}
            >
              {exporting ? t('adminPayments.history.exporting') : t('adminPayments.history.export')}
            </Button>
          </div>
          <div className={own.net}>
            <h2 id="history-net" className={own.netLabel}>
              {t('adminPayments.history.net')}
            </h2>
            <p className={own.netValue}>{text.amount(summary.net)}</p>
            <p className={own.netHint}>
              {t('adminPayments.history.netHint', {
                collected: text.amount(summary.collected),
                refunds: text.amount(summary.refunds),
                payments: t.plural('adminPayments.history.payments', summary.payments),
              })}
            </p>
          </div>
          <dl className={own.small}>
            {small.map((s) => (
              <div key={s.key} className={own.item}>
                <dt>{s.label}</dt>
                <dd className={s.tone}>{s.value}</dd>
              </div>
            ))}
          </dl>
          {summary.refundsPending > 0 && (
            <p className={own.pending}>
              <Icon name="clock" size="xs" />
              {t('adminPayments.history.refundsHint', {
                pending: text.amount(summary.refundsPending),
              })}
            </p>
          )}
        </section>

        <div className={styles.columns}>
          <section className={styles.panel} aria-label={t(`adminPayments.history.views.${view}`)}>
            <div
              className={own.views}
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
            <div className={own.tools}>
              <SearchField
                value={typed}
                onChange={setTyped}
                label={t('adminPayments.search.ledger')}
                placeholder={t('adminPayments.search.ledger')}
              />
              <div className={own.selects}>
                <Select
                  id="history-channel"
                  label={t('adminPayments.channels.label')}
                  hideLabel
                  value={channel}
                  onChange={(event) =>
                    setChannel(CHANNELS.find((c) => c === event.target.value) ?? 'all')
                  }
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c === 'all'
                        ? t('adminPayments.history.channelAll')
                        : t(`adminPayments.channels.${c}`)}
                    </option>
                  ))}
                </Select>
                {methods.length > 1 && (
                  <Select
                    id="history-method"
                    label={t('adminPayments.methodFilter.label')}
                    hideLabel
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                  >
                    <option value="all">{t('adminPayments.history.methodAll')}</option>
                    {methods.map((m) => (
                      <option key={m} value={m}>
                        {methodLabel(m)}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              {filtered && (
                <p className={own.filterNote}>
                  <span>{t('adminPayments.history.totalsNote')}</span>
                  <button type="button" className={own.clear} onClick={clear}>
                    {t('adminPayments.history.clear')}
                  </button>
                </p>
              )}
            </div>
            <div className={styles.body}>
              {lines.length > 0 ? (
                <>
                  {byDay.map(({ day, items }) => {
                    const net = items.reduce(
                      (sum, l) => sum + (l.kind === 'refund' ? -l.amount : l.amount),
                      0,
                    );
                    const count = items.filter((l) => l.kind === 'payment').length;
                    return (
                      <section key={day} className={own.day} aria-label={dayLabel(day)}>
                        <h3 className={own.dayHead}>
                          <span>{dayLabel(day)}</span>
                          <span className={own.dayTotal}>
                            {t('adminPayments.history.dayLine', {
                              count: t.plural('adminPayments.history.payments', count),
                              amount: text.amount(net),
                            })}
                          </span>
                        </h3>
                        <ul className={styles.ledger}>
                          {items.map((line) => (
                            <LedgerRow key={line.id} entry={line} />
                          ))}
                        </ul>
                      </section>
                    );
                  })}
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
                  actions={
                    filtered ? (
                      <Button variant="secondary" size="sm" onClick={clear}>
                        {t('adminPayments.history.clear')}
                      </Button>
                    ) : undefined
                  }
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
      <section className={own.days} aria-label={t('adminPayments.history.days')}>
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
      </section>
      {content}
    </div>
  );
}
