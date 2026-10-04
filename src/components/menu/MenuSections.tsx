'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Chip, Icon } from '@/components/ui';
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
  /** Show only the first N dishes with a "See all" link. */
  preview?: number;
  /** Draw the thick divider above (mobile). */
  divider?: boolean;
}

/** A category block on the menu home: heading, count or "See all", dish list. */
export function CategorySection({ category, preview, divider }: CategorySectionProps) {
  const { filters } = useFilters();
  const menu = useMenu();
  const t = useContent('menu');
  const total = useMemo(() => menu.dishesIn(category.id), [menu, category.id]);
  const all = useMemo(
    () => sortDishes(applyFilters(total, filters, menu.priceFilter), 'recommended'),
    [total, filters, menu.priceFilter],
  );
  const shown = useMemo(() => (preview ? all.slice(0, preview) : all), [all, preview]);
  const titleId = `sec-${category.id}`;
  const truncated = preview !== undefined && all.length > shown.length;

  return (
    <>
      {divider && <div className={styles.divider} aria-hidden="true" />}
      <section id={category.id} className={styles.section} aria-labelledby={titleId}>
        <div className={styles.sectionHead}>
          <h2 id={titleId} className="t-h2">
            {category.name}
          </h2>
          {truncated ? (
            <Link href={`/menu/${category.id}/`} className={styles.seeAll}>
              {t('home.seeAll', { count: total.length })}
              <Icon name="chev" size="xs" />
            </Link>
          ) : (
            <span className="t-small c3">{menu.categoryCountLabel(category)}</span>
          )}
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
