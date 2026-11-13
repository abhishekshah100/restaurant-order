'use client';

import { useContent, useInventoryDashboard, useInventoryUsage, useStockCounts } from '@/api/hooks';
import { Button, Icon } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { cx } from '@/lib/cx';
import { shiftDay } from '@/lib/dayRange';
import { biggestProblem, change, countStreak } from '@/lib/inventoryWeek';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryText } from './useInventoryText';
import styles from './WeekCard.module.css';

/** A streak worth saying (one week isn't yet). */
const STREAK_FROM = 2;
/** Waste down at least this much: worth a well done. */
const WELL_DONE_PCT = -10;

/**
 * This week (the last 7 days) against the 7 before: what was wasted and what went missing (green
 * when less), food cost, the item that cost most, and how many weeks in a row stock was counted.
 * Shareable on WhatsApp as a short message. Managers only (it's about money).
 */
export function WeekCard({ onPrices }: { onPrices: () => void }) {
  const t = useContent('common');
  const { branch, clock, can } = useAdminWorkspace();
  const text = useInventoryText();
  const now = useNow();
  const today = now ? clock.dayKey(now) : null;
  const shown = can('inventory.manage', 'reports.view') && today !== null;
  const week = useInventoryUsage(
    branch.id,
    today ? { from: shiftDay(today, -6), to: today } : {},
    shown,
  ).data;
  const before = useInventoryUsage(
    branch.id,
    today ? { from: shiftDay(today, -13), to: shiftDay(today, -7) } : {},
    shown,
  ).data;
  const counts = useStockCounts(branch.id, shown).data?.counts;
  const rises = useInventoryDashboard(branch.id, 'branch', shown).data?.priceRises ?? [];
  if (!shown || !week?.total || !now) return null;

  const wasted = week.total.wastage;
  const missing = Math.max(0, week.total.unexplained);
  const wastedChange = before?.total ? change(wasted, before.total.wastage) : undefined;
  const missingChange = before?.total
    ? change(missing, Math.max(0, before.total.unexplained))
    : undefined;
  const problem = biggestProblem(week);
  const streak = countStreak(
    (counts ?? []).flatMap((c) => (c.status === 'applied' && c.appliedAt ? [c.appliedAt] : [])),
    now,
  );
  const foodCost =
    week.foodCost?.actual !== undefined && week.foodCost.actual > 0
      ? `${Math.round(week.foodCost.actual * 10) / 10}%`
      : undefined;

  const trend = (pct: number | undefined) =>
    pct === undefined || pct === 0 ? null : (
      <span className={cx(styles.trend, pct < 0 ? styles.better : styles.worse)}>
        {pct < 0
          ? t('adminInventory.week.down', { pct: -pct })
          : t('adminInventory.week.up', { pct })}
      </span>
    );

  const message = [
    t('adminInventory.week.shareTitle', { branch: branch.name }),
    t('adminInventory.week.shareWasted', { amount: text.value(wasted) }),
    t('adminInventory.week.shareMissing', { amount: text.value(missing) }),
    foodCost ? t('adminInventory.week.shareFoodCost', { pct: foodCost }) : null,
    problem
      ? t(`adminInventory.week.problem.${problem.kind}`, {
          name: problem.name,
          amount: text.value(problem.value),
        })
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <section className={styles.card} aria-labelledby="inventory-week">
      <div className={styles.head}>
        <h2 id="inventory-week" className={styles.title}>
          {t('adminInventory.week.title')}
        </h2>
        <Button
          size="sm"
          variant="secondary"
          iconStart="msg"
          onClick={() =>
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
          }
        >
          {t('adminInventory.week.share')}
        </Button>
      </div>
      <dl className={styles.figures}>
        <div>
          <dt>{t('adminInventory.week.wasted')}</dt>
          <dd>
            {text.value(wasted)}
            {trend(wastedChange)}
          </dd>
        </div>
        <div>
          <dt>{t('adminInventory.week.missing')}</dt>
          <dd>
            {text.value(missing)}
            {trend(missingChange)}
          </dd>
        </div>
        {foodCost && (
          <div>
            <dt>{t('adminInventory.week.foodCost')}</dt>
            <dd>{foodCost}</dd>
          </div>
        )}
      </dl>
      {rises.length > 0 && (
        <button type="button" className={styles.prices} onClick={onPrices}>
          <Icon name="tag" size="xs" />
          {t('adminInventory.prices.weekly', {
            list: rises
              .slice(0, 3)
              .map((r) => `${r.name} +${Math.round(r.change)}%`)
              .join(', '),
          })}
          <Icon name="chev" size="xs" />
        </button>
      )}
      {problem && (
        <p className={styles.problem}>
          <Icon name="alert" size="xs" />
          {t(`adminInventory.week.problem.${problem.kind}`, {
            name: problem.name,
            amount: text.value(problem.value),
          })}
        </p>
      )}
      {(streak >= STREAK_FROM || (wastedChange !== undefined && wastedChange <= WELL_DONE_PCT)) && (
        <div className={styles.wins}>
          {wastedChange !== undefined && wastedChange <= WELL_DONE_PCT && (
            <span className={styles.win}>
              <Icon name="sparkle" size="xs" />
              {t('adminInventory.week.wasteDown', { pct: -wastedChange })}
            </span>
          )}
          {streak >= STREAK_FROM && (
            <span className={styles.win}>
              <Icon name="flame" size="xs" />
              {t('adminInventory.week.streak', { count: streak })}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
