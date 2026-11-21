'use client';

import type { CSSProperties } from 'react';

import type { SalesFigures } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { changeOf, type Change } from '@/lib/salesReport';
import styles from './Sales.module.css';

type Figure = 'netSales' | 'orders' | 'averageBill' | 'discounts' | 'refunds';

/** The headline numbers, in the order a manager reads them; for discounts and refunds less is better. */
const FIGURES: readonly { key: Figure; upIsGood: boolean }[] = [
  { key: 'netSales', upIsGood: true },
  { key: 'orders', upIsGood: true },
  { key: 'averageBill', upIsGood: true },
  { key: 'discounts', upIsGood: false },
  { key: 'refunds', upIsGood: false },
];

/**
 * The report's headline: each figure, how it moved against the span before (an arrow and words,
 * green when it's good news, red when it isn't), and a line saying what it counts. Net sales
 * leads, wider, with its days as a sparkline.
 */
export function KpiTiles({
  span,
  totals,
  before,
  amount,
  trend,
}: {
  /** What "before" is, in words: "the previous 30 days". */
  span: string;
  totals: SalesFigures;
  before: SalesFigures;
  amount: (value: number) => string;
  /** Net sales day by day (or week, month), for the sparkline. */
  trend: readonly number[];
}) {
  const t = useContent('common');
  // Counts as they are; the average bill to the whole rupee (a headline, not a bill line).
  const text = (key: Figure, value: number) =>
    key === 'orders' ? String(value) : amount(key === 'averageBill' ? Math.round(value) : value);
  return (
    <section className={styles.kpis} aria-label={t('adminSales.kpi.label')}>
      {FIGURES.map(({ key, upIsGood }) => {
        const change = changeOf(totals[key], before[key], upIsGood);
        const none = totals[key] === 0 && before[key] === 0;
        const figure = text(key, totals[key]);
        return (
          <article key={key} className={cx(styles.kpi, key === 'netSales' && styles.kpiLead)}>
            <h2 className={styles.kpiLabel}>{t(`adminSales.kpi.${key}.label`)}</h2>
            {/* Its length sizes it to fit the tile on one line (Sales.module.css › .kpiValue). */}
            <p
              className={styles.kpiValue}
              style={{ '--chars': Math.max(figure.length, 6) } as CSSProperties}
            >
              {figure}
            </p>
            <p className={styles.kpiChange}>
              {none ? (
                <span className={styles.kpiBefore}>{t('adminSales.kpi.none')}</span>
              ) : (
                <>
                  <ChangeBadge change={change} />
                  <span className={styles.kpiBefore}>
                    {before[key] > 0
                      ? t('adminSales.kpi.vs', { value: text(key, before[key]), span })
                      : t('adminSales.kpi.nothingBefore', { span })}
                  </span>
                </>
              )}
            </p>
            {key === 'netSales' && trend.length > 1 && (
              <Sparkline values={trend} label={t('adminSales.kpi.trendLabel')} />
            )}
            <p className={styles.kpiHint}>{t(`adminSales.kpi.${key}.hint`)}</p>
          </article>
        );
      })}
    </section>
  );
}

/** "▲ 12% up": the arrow and the words say it; the colour only adds whether it's good. */
export function ChangeBadge({ change }: { change: Change }) {
  const t = useContent('common');
  if (change.percent === null || change.direction === 'flat') {
    return change.direction === 'flat' ? (
      <span className={cx(styles.badge, styles.neutral)}>{t('adminSales.kpi.same')}</span>
    ) : null;
  }
  const words =
    change.direction === 'up'
      ? t('adminSales.kpi.up', { percent: Math.abs(change.percent) })
      : t('adminSales.kpi.down', { percent: Math.abs(change.percent) });
  return (
    <span className={cx(styles.badge, styles[change.tone])}>
      <span aria-hidden="true">{change.direction === 'up' ? '▲' : '▼'}</span>
      {words}
    </span>
  );
}

/** A small line of the span's sales, its last point marked: the shape at a glance. */
function Sparkline({ values, label }: { values: readonly number[]; label: string }) {
  const width = 160;
  const height = 36;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((v, i) => [i * step, height - 4 - (v / max) * (height - 8)] as const);
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  const area = `${path.join(' ')} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = points.at(-1) ?? [0, 0];
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <path d={area} className={styles.sparkArea} />
      <path d={path.join(' ')} className={styles.sparkLine} vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="3.5" className={styles.sparkDot} />
    </svg>
  );
}
