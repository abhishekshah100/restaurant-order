'use client';

import { useState } from 'react';
import type { SalesDish, SlowDish } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { Button, Chip, VegMark } from '@/components/ui';
import { cx } from '@/lib/cx';
import { shortDay } from '@/lib/salesReport';
import styles from './Sales.module.css';

const TOP = 10;
type Rank = 'sales' | 'quantity';

/**
 * Best sellers: the top dishes by sales or by how many sold, each with its share of the leader
 * as a bar; all of them on request. Under them, the dishes on the menu that sold least (none,
 * perhaps), a new one marked as such: what to look at when planning the menu.
 */
export function DishRanking({
  dishes,
  slow,
  amount,
}: {
  dishes: readonly SalesDish[];
  slow: readonly SlowDish[];
  amount: (value: number) => string;
}) {
  const t = useContent('common');
  const [rank, setRank] = useState<Rank>('sales');
  const [all, setAll] = useState(false);
  const ranked = [...dishes].sort((a, b) =>
    rank === 'sales'
      ? b.sales - a.sales || b.quantity - a.quantity
      : b.quantity - a.quantity || b.sales - a.sales,
  );
  const shown = all ? ranked : ranked.slice(0, TOP);
  const lead = rank === 'sales' ? (ranked[0]?.sales ?? 0) : (ranked[0]?.quantity ?? 0);
  const sold = (count: number) => t.plural('adminSales.dishes.sold', count);
  const categoryOf = (name: string | null) => name ?? t('adminSales.dishes.removed');

  return (
    <section className={styles.card} aria-labelledby="sales-dishes">
      <div className={styles.cardHead}>
        <div>
          <h2 id="sales-dishes" className={styles.cardTitle}>
            {t('adminSales.dishes.title')}
          </h2>
          <p className={styles.cardHint}>{t('adminSales.dishes.hint')}</p>
        </div>
        {dishes.length > 1 && (
          <div className={styles.toggle} role="group" aria-label={t('adminSales.dishes.by.label')}>
            {(['sales', 'quantity'] as const).map((r) => (
              <Chip key={r} pressed={rank === r} onClick={() => setRank(r)}>
                {t(`adminSales.dishes.by.${r}`)}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {dishes.length === 0 ? (
        <p className={styles.empty}>{t('adminSales.dishes.empty')}</p>
      ) : (
        <ol className={styles.ranking}>
          {shown.map((d, i) => {
            const value = rank === 'sales' ? d.sales : d.quantity;
            return (
              <li key={d.slug ?? `name:${d.name}`} className={styles.rankRow}>
                <span className={cx(styles.rank, i === 0 && styles.rankFirst)} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.rankMain}>
                  <span className={styles.rankName}>
                    <VegMark veg={d.veg} />
                    <span className={styles.rankDish}>{d.name}</span>
                    <span className={styles.rankCategory}>· {categoryOf(d.category)}</span>
                  </span>
                  <span className={styles.track} aria-hidden="true">
                    <span
                      className={styles.fill}
                      style={{ width: `${lead > 0 ? (value / lead) * 100 : 0}%` }}
                    />
                  </span>
                </span>
                <span className={styles.rankFigures}>
                  <strong>{rank === 'sales' ? amount(d.sales) : sold(d.quantity)}</strong>
                  <span>{rank === 'sales' ? sold(d.quantity) : amount(d.sales)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {ranked.length > TOP && (
        <Button variant="secondary" size="sm" className={styles.more} onClick={() => setAll(!all)}>
          {all
            ? t('adminSales.dishes.showTop', { count: TOP })
            : t('adminSales.dishes.showAll', { count: ranked.length })}
        </Button>
      )}

      {slow.length > 0 && (
        <div className={styles.slow}>
          <h3 className={styles.subTitle}>{t('adminSales.slow.title')}</h3>
          <p className={styles.cardHint}>{t('adminSales.slow.hint')}</p>
          <ul className={styles.slowList}>
            {slow.map((d) => (
              <li key={d.slug} className={styles.slowRow}>
                <VegMark veg={d.veg} />
                <span className={styles.slowName}>
                  {d.name}
                  <span className={styles.rankCategory}>{d.category}</span>
                </span>
                <span className={styles.slowTags}>
                  {d.addedOn && (
                    <span className={cx(styles.tag, styles.tagNew)}>
                      {t('adminSales.slow.added', { date: shortDay(d.addedOn) })}
                    </span>
                  )}
                  <span className={cx(styles.tag, d.quantity === 0 && styles.tagNone)}>
                    {d.quantity === 0 ? t('adminSales.slow.none') : sold(d.quantity)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
