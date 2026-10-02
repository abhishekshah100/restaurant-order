'use client';

import { SearchLink, Tabs } from '@/components/ui';
import { BottomNav } from '@/components/layout/BottomNav';
import { CartBar } from '@/components/layout/CartBar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MenuShell } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { CartPanel } from '@/components/cart/CartPanel';
import { categories } from '@/data/menu';
import { CategorySidebar } from './CategorySidebar';
import { MenuFilterChips } from './FilterBars';
import { CategorySection, PicksSection } from './MenuSections';
import styles from './MenuViews.module.css';

export const MENU_TABS = [
  { id: 'recommended', label: 'Recommended', href: '#picks' },
  ...categories.map((c) => ({
    id: c.id,
    label: c.name,
    href: c.id === 'starters' ? '#starters' : `/menu/${c.id}/`,
  })),
];

/** Menu home (02 · w02): chef's picks, the full first category, previews of the rest. */
export function MenuHome() {
  const [first, ...rest] = categories;
  return (
    <>
      <SiteHeader />
      <MobileHeader variant="restaurant" />
      <div className={`${styles.top} hide-desktop`}>
        <SearchLink />
        <MenuFilterChips />
      </div>
      <Tabs
        className={`${styles.tabs} hide-desktop`}
        label="Menu sections"
        value="recommended"
        items={MENU_TABS}
      />
      <MenuShell
        sidebar={<CategorySidebar active="recommended" showAllergyNote />}
        cart={<CartPanel />}
      >
        <h1 className="visually-hidden">Menu</h1>
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
