'use client';

import { useMemo } from 'react';
import { SearchLink, Tabs } from '@/components/ui';
import { BottomNav } from '@/components/layout/BottomNav';
import { CartBar } from '@/components/layout/CartBar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MenuShell } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { OrderingBanner } from '@/components/status/OrderingBanner';
import { CartPanel } from '@/components/cart/CartPanel';
import { useContent, useMenu } from '@/api/hooks';
import { CategorySidebar } from './CategorySidebar';
import { MenuFilterChips } from './FilterBars';
import { CategorySection, PicksSection } from './MenuSections';
import styles from './MenuViews.module.css';

/** Menu home (02 · w02): chef's picks, the full first category, previews of the rest. */
export function MenuHome() {
  const { categories } = useMenu();
  const t = useContent('menu');
  const tabs = useMemo(
    () => [
      { id: 'recommended', label: t('sort.recommended'), href: '#picks' },
      ...categories.map((c) => ({
        id: c.id,
        label: c.name,
        href: c.id === 'starters' ? '#starters' : `/menu/${c.id}/`,
      })),
    ],
    [categories, t],
  );
  const [first, ...rest] = categories;
  return (
    <>
      <SiteHeader />
      <MobileHeader variant="restaurant" />
      <OrderingBanner />
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
        <CategorySection category={first} />
        {rest.map((category) => (
          <CategorySection key={category.id} category={category} preview={2} divider />
        ))}
      </MenuShell>
      <CartBar />
      <BottomNav />
    </>
  );
}
