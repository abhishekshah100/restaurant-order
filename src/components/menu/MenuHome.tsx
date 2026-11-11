'use client';

import { useEffect, useMemo } from 'react';
import { SearchLink, Tabs } from '@/components/ui';
import { BottomNav } from '@/components/layout/BottomNav';
import { CartBar } from '@/components/layout/CartBar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MenuShell } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { OrderingBanner } from '@/components/status/OrderingBanner';
import { OfferBanner } from './OfferBanner';
import { CartPanel } from '@/components/cart/CartPanel';
import { useContent, useMenu } from '@/api/hooks';
import { CategorySidebar } from './CategorySidebar';
import { MenuFilterChips } from './FilterBars';
import { CategorySection, PicksSection } from './MenuSections';
import styles from './MenuViews.module.css';

/**
 * Menu home (02 · w02): chef's picks, then every category with all its dishes, so guests scroll
 * the whole menu without opening each category; the tabs and sidebar jump to a section. A link
 * to a section (`/menu/#soups`) lands on it once the menu is drawn. A simple menu (one category)
 * reads as one list: no category tab or heading.
 */
export function MenuHome() {
  const { categories } = useMenu();
  const t = useContent('menu');
  const simple = categories.length === 1;
  const tabs = useMemo(
    () => [
      { id: 'recommended', label: t('sort.recommended'), href: '#picks' },
      ...(categories.length > 1
        ? categories.map((c) => ({
            id: c.id,
            label: c.name,
            href: `#${c.id}`,
          }))
        : []),
    ],
    [categories, t],
  );

  // The section a link asked for (`#soups`), once its dishes are on the page.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && categories.some((c) => c.id === id)) {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    }
  }, [categories]);
  const [first, ...rest] = categories;
  return (
    <>
      <SiteHeader />
      <MobileHeader variant="restaurant" />
      <OrderingBanner />
      <OfferBanner />
      <div className={`${styles.top} hide-desktop`}>
        <SearchLink />
        <MenuFilterChips />
      </div>
      <Tabs
        className={`${styles.tabs} hide-desktop`}
        label={t('nav.menuSections')}
        value="recommended"
        items={tabs}
      />
      <MenuShell
        sidebar={<CategorySidebar active="recommended" showAllergyNote />}
        cart={<CartPanel />}
      >
        <h1 className="visually-hidden">{t('nav.menu')}</h1>
        <PicksSection />
        <CategorySection category={first} hideTitle={simple} />
        {rest.map((category) => (
          <CategorySection key={category.id} category={category} divider />
        ))}
      </MenuShell>
      <CartBar />
      <BottomNav />
    </>
  );
}
