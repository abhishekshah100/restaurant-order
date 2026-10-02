'use client';

import { IconButton, Tabs } from '@/components/ui';
import { CartBar } from '@/components/layout/CartBar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MenuShell } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { CartPanel } from '@/components/cart/CartPanel';
import { categories } from '@/data/menu';
import { useFilters } from '@/context/FiltersContext';
import { cx } from '@/lib/cx';
import {
  applyFilters,
  categoryCountLabel,
  dishesIn,
  filterSummary,
  hasActiveFilters,
  sortDishes,
} from '@/lib/menu';
import type { Category } from '@/types/menu';
import { Breadcrumbs } from './Breadcrumbs';
import { CategorySidebar } from './CategorySidebar';
import { DishList } from './DishList';
import { ActiveFilterRow, CategoryDesktopActions, CategoryFilterChips } from './FilterBars';
import styles from './MenuViews.module.css';

const TABS = categories.map((c) => ({ id: c.id, label: c.name, href: `/menu/${c.id}/` }));

/** Category view (03 · w03). */
export function CategoryView({ category }: { category: Category }) {
  const { filters, sort } = useFilters();
  const all = dishesIn(category.id);
  const shown = sortDishes(applyFilters(all, filters), sort);
  const active = hasActiveFilters(filters);
  const summary = filterSummary(filters, shown.length, all.length);
  const count = categoryCountLabel(category);

  return (
    <>
      <SiteHeader />
      <MobileHeader
        variant="topbar"
        title="Menu"
        titleAs="p"
        backHref="/menu/"
        backLabel="Back to menu"
        actions={<IconButton icon="search" label="Search" href="/search/" />}
      />
      <Tabs className="hide-desktop" label="Categories" value={category.id} items={TABS} />
      <MenuShell sidebar={<CategorySidebar active={category.id} />} cart={<CartPanel />} tight>
        <Breadcrumbs items={[{ label: 'Menu', href: '/menu/' }, { label: category.name }]} />
        <div className={styles.catHead}>
          <div className={styles.pageHead}>
            <div className={styles.titleBlock}>
              <h1 className={styles.catTitle}>{category.name}</h1>
              <p className="t-small c2 hide-desktop">
                {count} · {category.description}
              </p>
              <p className="t-body c2 hide-mobile">
                {category.description} · {count}
              </p>
            </div>
            <CategoryDesktopActions />
          </div>
          <CategoryFilterChips />
          {active && (
            <p className="t-small c3 hide-desktop" aria-live="polite">
              {summary}
            </p>
          )}
          {active && <ActiveFilterRow summary={summary} />}
        </div>
        {shown.length > 0 ? (
          <div className={styles.list}>
            <DishList dishes={shown} label={category.name} showPrepTime />
          </div>
        ) : (
          <p className={cx('t-body c2', styles.empty)}>
            No {category.name.toLowerCase()} match these filters.
          </p>
        )}
      </MenuShell>
      <CartBar noNav />
    </>
  );
}
