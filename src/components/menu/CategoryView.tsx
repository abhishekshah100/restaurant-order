'use client';

import { useMemo } from 'react';
import { IconButton, Tabs } from '@/components/ui';
import { CartBar } from '@/components/layout/CartBar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MenuShell } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { OrderingBanner } from '@/components/status/OrderingBanner';
import { OfferBanner } from './OfferBanner';
import { CartPanel } from '@/components/cart/CartPanel';
import { useContent, useMenu } from '@/api/hooks';
import { useFilters } from '@/context/FiltersContext';
import { cx } from '@/lib/cx';
import { applyFilters, filterSummaryKind, hasActiveFilters, sortDishes } from '@/lib/menu';
import type { Category } from '@/types/menu';
import { Breadcrumbs } from './Breadcrumbs';
import { CategorySidebar } from './CategorySidebar';
import { DishList } from './DishList';
import { NotOnMenu } from './NotOnMenu';
import { ActiveFilterRow, CategoryDesktopActions, CategoryFilterChips } from './FilterBars';
import styles from './MenuViews.module.css';

/** Category view (03 · w03), from the guest's branch menu. */
export function CategoryView({ categoryId }: { categoryId: string }) {
  const category = useMenu().getCategory(categoryId);
  return category ? <CategoryPage category={category} /> : <NotOnMenu />;
}

function CategoryPage({ category }: { category: Category }) {
  const { filters, sort } = useFilters();
  const menu = useMenu();
  const t = useContent('menu');
  const tabs = useMemo(
    () => menu.categories.map((c) => ({ id: c.id, label: c.name, href: `/menu/${c.id}/` })),
    [menu],
  );
  const all = useMemo(() => menu.dishesIn(category.id), [menu, category.id]);
  const shown = useMemo(
    () => sortDishes(applyFilters(all, filters, menu.priceFilter), sort),
    [all, filters, sort, menu.priceFilter],
  );
  const active = hasActiveFilters(filters);
  const summary = t.plural(`filters.summary.${filterSummaryKind(filters)}`, shown.length, {
    total: all.length,
  });
  const count = menu.categoryCountLabel(category);

  return (
    <>
      <SiteHeader />
      <MobileHeader
        variant="topbar"
        title={t('nav.menu')}
        titleAs="p"
        backHref="/menu/"
        backLabel={t('nav.backToMenu')}
        actions={<IconButton icon="search" label={t('nav.search')} href="/search/" />}
      />
      <OrderingBanner />
      <OfferBanner categoryId={category.id} />
      <Tabs className="hide-desktop" label={t('nav.categories')} value={category.id} items={tabs} />
      <MenuShell sidebar={<CategorySidebar active={category.id} />} cart={<CartPanel />} tight>
        <Breadcrumbs items={[{ label: t('nav.menu'), href: '/menu/' }, { label: category.name }]} />
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
            {/* Keeps the outline h1 → h2 → h3 (dish names) for screen-reader navigation. */}
            <h2 className="visually-hidden">{t('category.dishesHeading')}</h2>
            <DishList dishes={shown} label={category.name} showPrepTime />
          </div>
        ) : (
          <p className={cx('t-body c2', styles.empty)}>
            {t('category.noMatch', { category: category.name.toLowerCase() })}
          </p>
        )}
      </MenuShell>
      <CartBar noNav />
    </>
  );
}
