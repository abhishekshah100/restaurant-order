'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { isBackendEnabled } from '@/api/backend';
import type { SalesReport } from '@/api/contracts';
import { useAdminBranches, useContent, useSalesByBranch, useSalesReport } from '@/api/hooks';
import { Button, Chip, EmptyState, Icon } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { salesPath } from '@/lib/adminNav';
import { selectAdminBranch } from '@/lib/adminAuth';
import { hasFeature } from '@/lib/adminPlan';
import { cx } from '@/lib/cx';
import {
  dayCount,
  firstDay,
  parseDayRange,
  shiftDay,
  withPlanHistory,
  type DayRange,
} from '@/lib/dayRange';
import { numberLocale } from '@/lib/money';
import {
  SALES_LIMITS,
  axisDay,
  bestAndQuietest,
  compactAmount,
  grainOf,
  dayParts,
  hourLabel,
  hourStep,
  hourWindow,
  nepaliDay,
  openHours,
  peakHours,
  presetOf,
  rangeText,
  salesPresets,
  shareOf,
  shortDay,
  trendBuckets,
  type TrendBucket,
} from '@/lib/salesReport';
import { DateRangeFilter } from '../DateRangeFilter';
import { usePaymentText } from '../payments/usePaymentText';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { usePlanRefusal } from '../shell/PlanLimit';
import { BranchComparison } from './BranchComparison';
import { AverageKey, ColumnChart } from './ColumnChart';
import { DishRanking } from './DishRanking';
import { KpiTiles } from './KpiTiles';
import { MoneyStatement } from './MoneyStatement';
import { MeterList } from './MeterList';
import styles from './Sales.module.css';
import { useSalesExport } from './useSalesExport';
import { useSalesPdf } from './useSalesPdf';

/** Set on <html> while the report prints: everything else on the page is hidden. */
const PRINTING = 'printing-sales';

const DEFAULT_DAYS = 7;

/**
 * Sales (`reports.view`): the manager's report for the days picked — the headline numbers against
 * the span before, sales day by day (weeks or months for a long span), the busiest hours, and the
 * split by order type and by payment method. The days live in the address, so a report can be
 * bookmarked or shared; a preset is one tap.
 */
export function SalesReportPage() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock, brand, filePrefix } = useAdminWorkspace();
  const { amount } = usePaymentText();
  const exportReport = useSalesExport();
  const pdf = useSalesPdf();
  const [pdfSheet, setPdfSheet] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const now = useNow(60_000);
  const today = clock.dayKey(now ?? new Date());
  const fromParam = useQueryParam('from');
  const toParam = useQueryParam('to');
  const range: DayRange =
    fromParam || toParam
      ? parseDayRange(fromParam, toParam, today, SALES_LIMITS)
      : { from: shiftDay(today, -(DEFAULT_DAYS - 1)), to: today };
  // Quick ranges within the package's History days.
  const planDays = branch.plan?.limits.reportDays ?? null;
  const planFirst =
    planDays === null ? null : firstDay(today, withPlanHistory(undefined, planDays));
  const presets = salesPresets(today, branch.fiscalYears).filter(
    (p) => planFirst === null || p.range.from >= planFirst,
  );
  const preset = presetOf(presets, range);
  const [custom, setCustom] = useState(false);
  const [printing, setPrinting] = useState(false);
  /** The "What is Compared with?" note, open or not. */
  const [aboutCompare, setAboutCompare] = useState(false);
  // Esc closes it, wherever the focus is.
  useEffect(() => {
    if (!aboutCompare) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setAboutCompare(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aboutCompare]);
  // Every branch side by side: for staff who see reports at more than one.
  const viewParam = useQueryParam('view');
  const reportBranches = (useAdminBranches().data ?? []).filter((b) =>
    b.permissions?.includes('reports.view'),
  );
  // The advanced sales report: every branch side by side, export, PDF and print.
  const advanced = hasFeature(branch, 'salesAdvanced');
  const canCompare = advanced && reportBranches.length > 1;
  const view = canCompare && viewParam === 'branches' ? 'branches' : 'branch';
  const refusal = usePlanRefusal();
  const report = useSalesReport(isBackendEnabled() ? branch.id : undefined, range);
  const compare = useSalesByBranch(
    isBackendEnabled() && view === 'branches' ? branch.id : undefined,
    range,
  );
  const goTo = (next: DayRange, nextView: 'branch' | 'branches' = view) =>
    router.replace(salesPath(next, nextView), { scroll: false });

  // Printing: the print sheet renders, the browser's dialog opens, then the sheet goes away.
  useEffect(() => {
    if (!printing) return;
    const root = document.documentElement;
    const done = () => {
      root.classList.remove(PRINTING);
      setPrinting(false);
    };
    root.classList.add(PRINTING);
    window.addEventListener('afterprint', done, { once: true });
    const id = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
      root.classList.remove(PRINTING);
    };
  }, [printing]);

  const period = (r: DayRange) => rangeText(r.from, r.to);
  const days = dayCount(range);
  /** What the figures are compared with, in words: "the previous 30 days". */
  const span = t.plural('adminSales.periods.previous', days);

  const data = report.data;
  // What a printed or PDF report shows: who and when, then the report (or the branches).
  const sheetHead = data && (
    <header className={styles.printHead}>
      <div>
        <p className={styles.printBrand}>{brand}</p>
        <h1 className={styles.printTitle}>{t('adminSales.print.title')}</h1>
        <p className={styles.subtitle}>
          {t('adminSales.print.page', { branch: branch.name, period: period(range) })}
        </p>
        <p className={styles.compared}>
          {t('adminSales.compared', { period: period(data.previous), span })}
        </p>
      </div>
      <p className={styles.compared}>
        {t('adminSales.print.generated', { time: clock.dateTime(new Date()) })}
      </p>
    </header>
  );
  const sheetBody =
    data &&
    (view === 'branches' && compare.data ? (
      <BranchComparison data={compare.data} currentId={branch.id} onOpen={() => {}} />
    ) : (
      <Report data={data} onPick={() => {}} amount={amount} />
    ));

  if (!isBackendEnabled()) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t('adminSales.title')}</h1>
        <EmptyState icon="chart" tone="neutral" title={t('adminSales.needsServer.title')}>
          {t('adminSales.needsServer.body')}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{t('adminSales.title')}</h1>
          <p className={styles.branchLine}>{branch.name}</p>
          {/* The days shown, then the days they're compared with, each said in full. */}
          <dl className={styles.periods} aria-label={t('adminSales.periods.label')}>
            <div className={cx(styles.period, styles.periodNow)}>
              <dt>
                <Icon name="calendar" size="xs" />
                {t('adminSales.periods.showing')}
              </dt>
              <dd>
                <strong>{period(range)}</strong>
                <span>{t.plural('adminSales.periods.days', days)}</span>
              </dd>
            </div>
            {data && (
              <div className={styles.period}>
                <dt>
                  <Icon name="history" size="xs" />
                  {t('adminSales.periods.compared')}
                  <button
                    type="button"
                    className={styles.infoButton}
                    aria-expanded={aboutCompare}
                    aria-controls="sales-compare-about"
                    aria-label={t('adminSales.periods.about.button')}
                    onClick={() => setAboutCompare((open) => !open)}
                  >
                    <Icon name="info" size="xs" />
                  </button>
                </dt>
                <dd>
                  <strong>{period(data.previous)}</strong>
                  <span>{t.plural('adminSales.periods.justBefore', days)}</span>
                </dd>
              </div>
            )}
          </dl>
          {data && aboutCompare && (
            <div id="sales-compare-about" className={styles.about} role="note">
              <p>
                {t('adminSales.periods.about.showing', {
                  period: period(range),
                })}
              </p>
              <p>
                {t('adminSales.periods.about.compared', {
                  period: period(data.previous),
                  span: t.plural('adminSales.periods.justBefore', days),
                })}
              </p>
              <p className={styles.aboutExample}>
                {t('adminSales.periods.about.example', {
                  now: amount(data.totals.netSales),
                  before: amount(data.before.netSales),
                })}
              </p>
              <button
                type="button"
                className={styles.aboutClose}
                onClick={() => setAboutCompare(false)}
              >
                {t('adminSales.periods.about.close')}
              </button>
            </div>
          )}
        </div>
        {advanced && (
          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              iconStart="list"
              disabled={!data}
              aria-label={t('adminSales.actions.exportLabel')}
              onClick={() =>
                data &&
                exportReport(
                  data,
                  {
                    period: period(range),
                    compared: `${period(data.previous)} (${span})`,
                  },
                  view === 'branches' ? compare.data?.branches : undefined,
                )
              }
            >
              {t('adminSales.actions.export')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconStart="receipt"
              disabled={!data}
              loading={pdf.drawing}
              aria-label={t('adminSales.actions.pdfLabel')}
              onClick={() =>
                void pdf
                  .download(
                    () => {
                      flushSync(() => setPdfSheet(true));
                      return pdfRef.current;
                    },
                    t('adminSales.pdf.file', {
                      branch: filePrefix,
                      from: range.from,
                      to: range.to,
                    }),
                  )
                  .finally(() => setPdfSheet(false))
              }
            >
              {t('adminSales.actions.pdf')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconStart="printer"
              disabled={!data}
              aria-label={t('adminSales.actions.printLabel')}
              onClick={() => setPrinting(true)}
            >
              {t('adminSales.actions.print')}
            </Button>
          </div>
        )}
      </header>

      {canCompare && (
        <div className={styles.views} role="group" aria-label={t('adminSales.view.label')}>
          {(['branch', 'branches'] as const).map((v) => (
            <Chip key={v} pressed={view === v} onClick={() => goTo(range, v)}>
              {t(`adminSales.view.${v}`)}
            </Chip>
          ))}
        </div>
      )}

      <div className={styles.filters}>
        <div className={styles.presets} role="group" aria-label={t('adminSales.presets.label')}>
          {presets.map((p) => (
            <Chip
              key={p.key}
              pressed={!custom && preset?.key === p.key}
              onClick={() => {
                setCustom(false);
                goTo(p.range);
              }}
            >
              {t(`adminSales.presets.${p.key}`, { label: p.label ?? '' })}
            </Chip>
          ))}
          <Chip pressed={custom || !preset} onClick={() => setCustom((open) => !open)}>
            {t('adminSales.presets.custom')}
          </Chip>
        </div>
        {(custom || !preset) && (
          <DateRangeFilter
            id="sales-days"
            planHistory
            range={range}
            today={today}
            limits={SALES_LIMITS}
            onChange={goTo}
          />
        )}
      </div>

      {view === 'branches' ? (
        compare.data ? (
          <div className={cx(styles.body, compare.isPlaceholderData && styles.refreshing)}>
            <BranchComparison
              data={compare.data}
              currentId={branch.id}
              onOpen={(id) => {
                selectAdminBranch(id);
                goTo(range, 'branch');
              }}
            />
          </div>
        ) : compare.isError ? (
          <EmptyState
            icon="alert"
            tone="err"
            title={refusal(compare.error) ?? t('adminSales.branches.failed')}
          />
        ) : (
          <ReportSkeleton />
        )
      ) : data ? (
        <div className={cx(styles.body, report.isPlaceholderData && styles.refreshing)}>
          <Report data={data} onPick={goTo} amount={amount} />
        </div>
      ) : report.isError && refusal(report.error) ? (
        // Further back than the package's report history: say so, not "try again".
        <EmptyState icon="lock" tone="brand" title={refusal(report.error)} />
      ) : report.isError ? (
        <EmptyState
          icon="alert"
          tone="err"
          title={t('adminSales.failed.title')}
          actions={
            <Button variant="secondary" iconStart="refresh" onClick={() => void report.refetch()}>
              {t('adminSales.failed.retry')}
            </Button>
          }
        >
          {t('adminSales.failed.body')}
        </EmptyState>
      ) : (
        <ReportSkeleton />
      )}

      {printing &&
        data &&
        createPortal(
          <article className={styles.printSheet} data-print-sheet="">
            {sheetHead}
            {sheetBody}
          </article>,
          document.body,
        )}

      {/* The PDF: the same sheet, drawn off-screen at A4 width while it's being made. */}
      {pdfSheet &&
        data &&
        createPortal(
          <div ref={pdfRef} className={styles.pdfSheet} aria-hidden="true">
            {sheetHead}
            <div data-pdf-body="">{sheetBody}</div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** The report's sections, for the data in hand. */
function Report({
  data,
  onPick,
  amount,
}: {
  data: SalesReport;
  onPick: (range: DayRange) => void;
  amount: (value: number) => string;
}) {
  const t = useContent('common');
  const { region, branch } = useAdminWorkspace();
  const { methodName } = usePaymentText();
  // The basic report (no advanced sales report in the package): the totals, the money, the
  // dishes; no charts, ways of ordering or categories (the server sends none of them).
  const advanced = hasFeature(branch, 'salesAdvanced');
  const months = t.get('adminSales.bsMonths') as readonly string[];
  const locale = numberLocale(region);
  const tick = (value: number) => compactAmount(value, locale, region.currency.symbol);
  const orders = (count: number) => t.plural('adminSales.orders', count);
  const dayTitle = (day: string, bs?: string) =>
    bs ? `${shortDay(day)} · ${nepaliDay(bs, months)}` : shortDay(day);

  const span = t.plural('adminSales.periods.previous', dayCount(data));
  const grain = grainOf(dayCount(data));
  const buckets = trendBuckets(data.days, grain);
  const bucketTitle = (b: TrendBucket) =>
    b.from === b.to
      ? dayTitle(b.from, b.bs)
      : t('adminSales.trend.range', { from: shortDay(b.from), to: shortDay(b.to) });
  const withSales = buckets.filter((b) => b.orders > 0);
  const average =
    withSales.length > 1
      ? withSales.reduce((sum, b) => sum + b.netSales, 0) / buckets.length
      : undefined;
  const extremes = grain === 'day' ? bestAndQuietest(data.days) : null;

  const hours = openHours(data.hours);
  const peaks = peakHours(data.hours);
  const peakKeys = new Set(peaks.map((h) => h.hour));
  const [first, second] = peaks;

  const modesTotal = data.byMode.reduce((sum, m) => sum + m.netSales, 0);
  const received = data.byMethod.reduce((sum, m) => sum + m.amount, 0);

  return (
    <>
      <KpiTiles
        span={span}
        totals={data.totals}
        before={data.before}
        amount={amount}
        trend={buckets.map((b) => b.netSales)}
      />

      {advanced && (
        <section className={cx(styles.card, styles.trendCard)} aria-labelledby="sales-trend">
          <div className={styles.cardHead}>
            <div>
              <h2 id="sales-trend" className={styles.cardTitle}>
                {t(`adminSales.trend.title.${grain}`)}
              </h2>
              <p className={styles.cardHint}>{t(`adminSales.trend.hint.${grain}`)}</p>
              {average !== undefined && data.totals.orders > 0 && (
                <AverageKey
                  label={`${t('adminSales.trend.average', { amount: amount(Math.round(average)) })} ${t(`adminSales.trend.averageHint.${grain}`)}`}
                />
              )}
            </div>
            {extremes && (
              <dl className={styles.extremes}>
                <div>
                  <dt>{t('adminSales.trend.best')}</dt>
                  <dd>
                    <strong>{amount(extremes.best.netSales)}</strong>
                    <span>{shortDay(extremes.best.day)}</span>
                  </dd>
                </div>
                <div>
                  <dt>{t('adminSales.trend.quiet')}</dt>
                  <dd>
                    <strong>{amount(extremes.quiet.netSales)}</strong>
                    <span>{shortDay(extremes.quiet.day)}</span>
                  </dd>
                </div>
              </dl>
            )}
          </div>
          {data.totals.orders === 0 ? (
            <p className={styles.empty}>{t('adminSales.trend.empty')}</p>
          ) : (
            <ColumnChart
              caption={t(`adminSales.trend.title.${grain}`)}
              tableHeads={[
                t('adminSales.table.when'),
                t('adminSales.table.netSales'),
                t('adminSales.table.orders'),
              ]}
              formatTick={tick}
              average={average !== undefined ? { value: average } : undefined}
              columns={buckets.map((b, i) => ({
                key: `${b.from}_${b.to}`,
                value: b.netSales,
                axis: axisLabel(b, i, buckets.length, grain),
                title: bucketTitle(b),
                valueText: amount(b.netSales),
                detail: orders(b.orders),
              }))}
              onPick={(key) => {
                const [from = '', to = ''] = key.split('_');
                onPick({ from, to });
              }}
              pickLabel={() => t(`adminSales.trend.pick.${grain}`)}
            />
          )}
        </section>
      )}

      <div className={styles.grid} data-pdf-split="">
        {advanced && (
          <>
            <section className={styles.card} aria-labelledby="sales-hours">
              <div className={styles.cardHead}>
                <div>
                  <h2 id="sales-hours" className={styles.cardTitle}>
                    {t('adminSales.hours.title')}
                  </h2>
                  <p className={styles.cardHint}>
                    {first
                      ? t('adminSales.hours.peak', {
                          hours: second
                            ? t('adminSales.hours.and', {
                                first: hourWindow(first.hour),
                                second: hourWindow(second.hour),
                              })
                            : hourWindow(first.hour),
                        })
                      : t('adminSales.hours.hint')}
                  </p>
                </div>
              </div>
              {hours.length === 0 ? (
                <p className={styles.empty}>{t('adminSales.hours.empty')}</p>
              ) : (
                <ColumnChart
                  height={150}
                  emphasis
                  caption={t('adminSales.hours.title')}
                  tableHeads={[
                    t('adminSales.table.when'),
                    t('adminSales.table.netSales'),
                    t('adminSales.table.orders'),
                  ]}
                  formatTick={tick}
                  columns={hours.map((h) => ({
                    key: String(h.hour),
                    value: h.netSales,
                    axis: h.hour % hourStep(hours.length) === 0 ? hourLabel(h.hour) : '',
                    title: hourWindow(h.hour),
                    valueText: amount(h.netSales),
                    detail: orders(h.orders),
                    highlight: peakKeys.has(h.hour),
                  }))}
                />
              )}
              {hours.length > 0 && (
                <div className={styles.dayParts}>
                  <h3 className={styles.subTitle}>{t('adminSales.hours.parts.title')}</h3>
                  <MeterList
                    label={t('adminSales.hours.parts.title')}
                    compact
                    rows={dayParts(data.hours).map((part) => {
                      const share = shareOf(part.netSales, data.totals.netSales);
                      return {
                        key: part.key,
                        name: t(`adminSales.hours.parts.${part.key}`),
                        valueText: amount(part.netSales),
                        share,
                        detail: `${hourWindowSpan(part.from, part.to)} · ${t('adminSales.share', { percent: share })}`,
                        quiet: part.orders === 0,
                      };
                    })}
                  />
                </div>
              )}
            </section>

            <section className={styles.card} aria-labelledby="sales-modes">
              <div className={styles.cardHead}>
                <div>
                  <h2 id="sales-modes" className={styles.cardTitle}>
                    {t('adminSales.modes.title')}
                  </h2>
                  <p className={styles.cardHint}>{t('adminSales.modes.hint')}</p>
                </div>
              </div>
              <MeterList
                label={t('adminSales.modes.title')}
                rows={[...data.byMode]
                  .filter((m) => m.orders > 0 || data.totals.orders === 0)
                  .sort((a, b) => b.netSales - a.netSales)
                  .map((m) => {
                    const share = shareOf(m.netSales, modesTotal);
                    return {
                      key: m.mode,
                      name: t(`adminSales.modes.${m.mode}`),
                      valueText: amount(m.netSales),
                      share,
                      detail: `${orders(m.orders)} · ${t('adminSales.share', { percent: share })}`,
                    };
                  })}
              />
            </section>
          </>
        )}

        <section className={styles.card} aria-labelledby="sales-methods">
          <div className={styles.cardHead}>
            <div>
              <h2 id="sales-methods" className={styles.cardTitle}>
                {t('adminSales.methods.title')}
              </h2>
              <p className={styles.cardHint}>{t('adminSales.methods.hint')}</p>
            </div>
          </div>
          {data.byMethod.length === 0 ? (
            <p className={styles.empty}>{t('adminSales.methods.empty')}</p>
          ) : (
            <MeterList
              label={t('adminSales.methods.title')}
              rows={data.byMethod.map((m) => {
                const share = shareOf(m.amount, received);
                return {
                  key: `${m.method}-${m.channel}`,
                  name: methodName(m.method),
                  valueText: amount(m.amount),
                  share,
                  detail: `${t.plural('adminSales.methods.payments', m.count)} · ${t('adminSales.share', { percent: share })}`,
                  ...(m.refunds > 0
                    ? { note: t('adminSales.methods.refunded', { amount: amount(m.refunds) }) }
                    : {}),
                };
              })}
            />
          )}
        </section>
      </div>

      <div className={styles.split} data-pdf-split="">
        <DishRanking dishes={data.dishes} slow={data.slowDishes} amount={amount} />
        {advanced && (
          <section className={styles.card} aria-labelledby="sales-categories">
            <div className={styles.cardHead}>
              <div>
                <h2 id="sales-categories" className={styles.cardTitle}>
                  {t('adminSales.categories.title')}
                </h2>
                <p className={styles.cardHint}>{t('adminSales.categories.hint')}</p>
              </div>
            </div>
            {data.categories.length === 0 ? (
              <p className={styles.empty}>{t('adminSales.categories.empty')}</p>
            ) : (
              <MeterList
                label={t('adminSales.categories.title')}
                rows={data.categories.map((c) => {
                  const share = shareOf(c.sales, data.totals.itemSales);
                  return {
                    key: c.name ?? 'removed',
                    name: c.name ?? t('adminSales.categories.removed'),
                    valueText: amount(c.sales),
                    share,
                    detail: `${t.plural('adminSales.dishes.sold', c.quantity)} · ${t.plural('adminSales.categories.dishes', c.dishes)} · ${t('adminSales.share', { percent: share })}`,
                  };
                })}
              />
            )}
          </section>
        )}
      </div>

      <MoneyStatement
        money={data.money}
        staffRefunds={data.totals.refunds}
        range={{ from: data.from, to: data.to }}
      />

      {data.cancelled.orders > 0 && (
        <p className={styles.footnote}>
          {t('adminSales.cancelled', {
            orders: orders(data.cancelled.orders),
            amount: amount(data.cancelled.billed),
          })}
        </p>
      )}
    </>
  );
}

/** "6–11 AM", "10 PM–6 AM": a part of the day, as staff say it. */
function hourWindowSpan(from: number, to: number) {
  const [fromNum, fromHalf] = hourLabel(from).split(' ');
  const [toNum, toHalf] = hourLabel(to).split(' ');
  return fromHalf === toHalf
    ? `${fromNum}–${toNum} ${toHalf}`
    : `${fromNum} ${fromHalf}–${toNum} ${toHalf}`;
}

/** At most about eight labels under the columns, so they never crowd (on a phone either). */
function axisLabel(b: TrendBucket, index: number, count: number, grain: 'day' | 'week' | 'month') {
  const every = Math.max(1, Math.ceil(count / 8));
  return index % every === 0 ? axisDay(b.from, grain, index === 0) : '';
}

/** While the first report loads: the page's shape, quietly. */
function ReportSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <div className={styles.skeletonKpis}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={styles.skeletonBlock} />
        ))}
      </div>
      <span className={cx(styles.skeletonBlock, styles.skeletonChart)} />
    </div>
  );
}
