'use client';

import { useState } from 'react';
import { useContent, useIngredients, useInventoryUsage } from '@/api/hooks';
import { Button } from '@/components/ui';
import { cx } from '@/lib/cx';
import { shiftDay, type DayRange } from '@/lib/dayRange';
import type { UsageRow } from '@/types/inventory';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useInventoryExport } from './useInventoryExport';
import { useInventoryText } from './useInventoryText';
import styles from './Inventory.module.css';

const percent = (n: number | undefined) =>
  n === undefined ? '—' : `${(Math.round(n * 10) / 10).toFixed(1)}%`;

/**
 * The usage report for some days: per item, what really went (stock at the start, plus what
 * came in, less what's left) against what recipes say went, what was recorded as waste, and what
 * nobody can explain; by category, and food cost against food sales (recipes and actual). Actual
 * usage is only right up to the last count, so the report says when that was.
 */
export function UsageTab({ today }: { today: string }) {
  const t = useContent('common');
  const { branch, can, clock } = useAdminWorkspace();
  const text = useInventoryText();
  const [range, setRange] = useState<DayRange>({ from: shiftDay(today, -29), to: today });
  const query = useInventoryUsage(branch.id, range);
  const categories = useIngredients(branch.id).data?.categories ?? [];
  const { download, busy } = useInventoryExport();
  const data = query.data;
  const nameOf = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <section className={styles.block} aria-label={t('adminInventory.tabs.usage')}>
      <div className={styles.filters}>
        <DateRangeFilter id="usage" range={range} today={today} onChange={setRange} />
        {can('inventory.manage', 'reports.view') && (
          <Button
            variant="secondary"
            iconStart="list"
            loading={busy === 'usage'}
            onClick={() => void download('usage', range, `usage-${range.from}-${range.to}`)}
          >
            {t('adminInventory.export.csv')}
          </Button>
        )}
      </div>
      <p className={styles.muted}>{t('adminInventory.usage.hint')}</p>
      {query.isError ? (
        <div className={styles.card}>
          <p>{t('adminInventory.failed')}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t('adminInventory.retry')}
          </Button>
        </div>
      ) : !data ? (
        <p className={styles.muted} aria-busy="true">
          {t('adminInventory.loading')}
        </p>
      ) : (
        <>
          <p className={cx(styles.card, !data.countedAt && styles.low)} role="status">
            {data.countedAt
              ? t('adminInventory.usage.countedAt', { time: clock.dateTime(data.countedAt) })
              : t('adminInventory.usage.noCount')}
          </p>
          {data.total && (
            <ul className={styles.tiles} aria-label={t('adminInventory.usage.summary')}>
              {(
                [
                  { id: 'sales', value: text.value(data.sales ?? 0) },
                  { id: 'actual', value: text.value(data.total.actual) },
                  { id: 'theoretical', value: text.value(data.total.theoretical) },
                  { id: 'wastage', value: text.value(data.total.wastage) },
                  { id: 'unexplained', value: text.signedWhole(-data.total.unexplained) },
                  { id: 'foodCostActual', value: percent(data.foodCost?.actual) },
                  { id: 'foodCostTheoretical', value: percent(data.foodCost?.theoretical) },
                ] as const
              ).map((tile) => (
                <li key={tile.id} className={styles.tile}>
                  <span className={styles.muted}>{t(`adminInventory.usage.tiles.${tile.id}`)}</span>
                  <span className={styles.tileValue}>{tile.value}</span>
                </li>
              ))}
            </ul>
          )}
          {data.categories.some((c) => c.value) && (
            <section className={styles.card} aria-labelledby="usage-categories">
              <h2 id="usage-categories" className={styles.blockTitle}>
                {t('adminInventory.usage.byCategory')}
              </h2>
              <ul className={styles.list}>
                {data.categories
                  .filter((c) => c.value && (c.value.actual !== 0 || c.value.unexplained !== 0))
                  .map((c) => (
                    <li key={c.id ?? 'none'} className={styles.row}>
                      <span className={styles.rowMain}>
                        <span className={styles.rowName}>
                          {c.name || t('adminInventory.stock.noCategory')}
                        </span>
                        {c.value && (
                          <span className={styles.muted}>
                            {[
                              t('adminInventory.usage.used', {
                                amount: text.value(c.value.actual),
                              }),
                              t('adminInventory.usage.recipes', {
                                amount: text.value(c.value.theoretical),
                              }),
                            ].join(' · ')}
                          </span>
                        )}
                      </span>
                      {c.value && <Unexplained amount={c.value.unexplained} value />}
                    </li>
                  ))}
              </ul>
            </section>
          )}
          {data.rows.length === 0 ? (
            <p className={styles.card}>{t('adminInventory.usage.empty')}</p>
          ) : (
            <ul className={styles.list} aria-label={t('adminInventory.usage.items')}>
              {data.rows.map((row) => (
                <li key={row.ingredientId}>
                  <UsageItem
                    row={row}
                    category={row.categoryId ? nameOf.get(row.categoryId) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function UsageItem({ row, category }: { row: UsageRow; category?: string }) {
  const t = useContent('common');
  const text = useInventoryText();
  const q = row.quantity;
  const qty = (n: number) => text.quantity(n, row.unit);
  return (
    <div className={styles.row}>
      <span className={styles.rowMain}>
        <span className={styles.rowName}>{row.name}</span>
        <span className={styles.muted}>
          {[
            category,
            t('adminInventory.usage.used', { amount: qty(q.actual) }),
            t('adminInventory.usage.recipes', { amount: qty(q.theoretical) }),
            q.wastage ? t('adminInventory.usage.wasted', { amount: qty(q.wastage) }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className={styles.muted}>
          {[
            t('adminInventory.usage.opening', { amount: qty(q.opening) }),
            t('adminInventory.usage.cameIn', { amount: qty(q.cameIn) }),
            t('adminInventory.usage.closing', { amount: qty(q.closing) }),
          ].join(' · ')}
        </span>
      </span>
      <span className={styles.rowSide}>
        <span
          className={cx(
            styles.quantity,
            q.unexplained > 0 ? styles.negative : q.unexplained < 0 && styles.positive,
          )}
        >
          {q.unexplained === 0
            ? t('adminInventory.usage.allExplained')
            : t('adminInventory.usage.unexplained', {
                amount: text.change(-q.unexplained, row.unit),
              })}
        </span>
        {row.value && row.value.unexplained !== 0 && (
          <span className={styles.muted}>{text.signedWhole(-row.value.unexplained)}</span>
        )}
      </span>
    </div>
  );
}

/** What's unexplained, in value: missing (red) or more than expected. */
function Unexplained({ amount }: { amount: number; value: true }) {
  const t = useContent('common');
  const text = useInventoryText();
  return (
    <span className={styles.rowSide}>
      <span
        className={cx(
          styles.quantity,
          amount > 0 ? styles.negative : amount < 0 && styles.positive,
        )}
      >
        {amount === 0 ? t('adminInventory.usage.allExplained') : text.signedWhole(-amount)}
      </span>
      {amount !== 0 && (
        <span className={styles.muted}>{t('adminInventory.usage.tiles.unexplained')}</span>
      )}
    </span>
  );
}
