'use client';

import Link from 'next/link';
import { Chip, Icon } from '@/components/ui';
import { useFilters } from '@/context/FiltersContext';
import { cx } from '@/lib/cx';
import { applyFilters, categoryCountLabel, dishesIn, featuredDishes, sortDishes } from '@/lib/menu';
import type { Category } from '@/types/menu';
import { DishCard } from './DishCard';
import { DishList } from './DishList';
import styles from './MenuSections.module.css';

/** "Chef's picks" — horizontal rail on mobile, 3-up grid on desktop with diet chips. */
export function PicksSection() {
  const { filters, setFilters } = useFilters();
  const picks = applyFilters(featuredDishes(), filters);
  const setDiet = (diet: typeof filters.diet) => setFilters((f) => ({ ...f, diet }));

  return (
    <section id="picks" className={styles.picks} aria-labelledby="picks-title">
      <div className={styles.picksHead}>
        <div className={styles.picksTitle}>
          <h2 id="picks-title" className="t-h2">
            Chef&apos;s picks
          </h2>
          <p className="t-small c2">Tonight&apos;s favourites from our kitchen</p>
        </div>
        <div className={cx(styles.chips, 'hide-mobile')} role="group" aria-label="Quick filters">
          <Chip pressed={filters.diet === 'all'} onClick={() => setDiet('all')}>
            All
          </Chip>
          <Chip veg pressed={filters.diet === 'veg'} onClick={() => setDiet('veg')}>
            Veg
          </Chip>
          <Chip veg={false} pressed={filters.diet === 'nonveg'} onClick={() => setDiet('nonveg')}>
            Non-veg
          </Chip>
        </div>
      </div>
      {picks.length > 0 ? (
        <ul className={styles.rail}>
          {picks.map((dish, i) => (
            <DishCard key={dish.slug} dish={dish} priority={i < 2} />
          ))}
        </ul>
      ) : (
        <p className={cx('t-small c3', styles.picksHead)}>
          No chef&apos;s picks match these filters.
        </p>
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
  const all = sortDishes(applyFilters(dishesIn(category.id), filters), 'recommended');
  const shown = preview ? all.slice(0, preview) : all;
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
              See all {dishesIn(category.id).length}
              <Icon name="chev" size="xs" />
            </Link>
          ) : (
            <span className="t-small c3">{categoryCountLabel(category)}</span>
          )}
        </div>
        {shown.length > 0 ? (
          <DishList dishes={shown} label={category.name} />
        ) : (
          <p className={cx('t-small c3', styles.empty)}>No dishes match these filters.</p>
        )}
      </section>
    </>
  );
}
