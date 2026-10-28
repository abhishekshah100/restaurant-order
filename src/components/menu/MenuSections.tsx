'use client';

import { useMemo } from 'react';
import { Chip } from '@/components/ui';
import { useFilters } from '@/context/FiltersContext';
import { cx } from '@/lib/cx';
import { useBranch, useContent, useMenu } from '@/api/hooks';
import { applyFilters, isVegMark, sortDishes } from '@/lib/menu';
import type { Category } from '@/types/menu';
import { DishCard } from './DishCard';
import { DishList } from './DishList';
import { useFilterActions } from './useFilterActions';
import styles from './MenuSections.module.css';

/** "Chef's picks" — horizontal rail on mobile, 3-up grid on desktop with diet chips. */
export function PicksSection() {
  const { filters } = useFilters();
  const { setDiet } = useFilterActions();
  const menu = useMenu();
  const t = useContent('menu');
  const { dietary } = useBranch();
  const picks = useMemo(
    () => applyFilters(menu.featuredDishes(), filters, menu.priceFilter),
    [menu, filters],
  );

  return (
    <section id="picks" className={styles.picks} aria-labelledby="picks-title">
      <div className={styles.picksHead}>
        <div className={styles.picksTitle}>
          <h2 id="picks-title" className="t-h2">
            {t('filters.chefsPicks')}
          </h2>
          <p className="t-small c2">{t('home.picksSubtitle')}</p>
        </div>
        <div
          className={cx(styles.chips, 'hide-mobile')}
          role="group"
          aria-label={t('filters.quickFilters')}
        >
          <Chip pressed={filters.diet === 'all'} onClick={() => setDiet('all')}>
            {t('filters.all')}
          </Chip>
          {dietary.marks.map((mark) => (
            <Chip
              key={mark}
              veg={isVegMark(mark)}
              pressed={filters.diet === mark}
              onClick={() => setDiet(mark)}
            >
              {t(`filters.diet.${mark}.chip`)}
            </Chip>
          ))}
        </div>
      </div>
      {picks.length > 0 ? (
        <ul className={styles.rail}>
          {picks.map((dish, i) => (
            <DishCard key={dish.slug} dish={dish} priority={i < 2} hideChefTag />
          ))}
        </ul>
      ) : (
        <p className={cx('t-small c3', styles.picksHead)}>{t('home.noPicks')}</p>
      )}
    </section>
  );
}

export interface CategorySectionProps {
  category: Category;
  /** Draw the thick divider above (mobile). */
  divider?: boolean;
}

/** A category block on the menu home: heading, its count, and all its dishes. */
export function CategorySection({ category, divider }: CategorySectionProps) {
  const { filters } = useFilters();
  const menu = useMenu();
  const t = useContent('menu');
  const shown = useMemo(
    () =>
      sortDishes(
        applyFilters(menu.dishesIn(category.id), filters, menu.priceFilter),
        'recommended',
      ),
    [menu, category.id, filters],
  );
  const titleId = `sec-${category.id}`;

  return (
    <>
      {divider && <div className={styles.divider} aria-hidden="true" />}
      <section id={category.id} className={styles.section} aria-labelledby={titleId}>
        <div className={styles.sectionHead}>
          <h2 id={titleId} className="t-h2">
            {category.name}
          </h2>
          <span className="t-small c3">{menu.categoryCountLabel(category)}</span>
        </div>
        {shown.length > 0 ? (
          <DishList dishes={shown} label={category.name} />
        ) : (
          <p className={cx('t-small c3', styles.empty)}>{t('home.noDishes')}</p>
        )}
      </section>
    </>
  );
}
