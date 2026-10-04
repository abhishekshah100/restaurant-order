'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, VegMark } from '@/components/ui';
import { useBranch, useContent, useMenu } from '@/api/hooks';
import { useFilters } from '@/context/FiltersContext';
import { cx } from '@/lib/cx';
import { isVegMark } from '@/lib/menu';
import type { CategoryId } from '@/types/menu';
import { useFilterActions } from './useFilterActions';
import styles from './CategorySidebar.module.css';

export interface CategorySidebarProps {
  /** 'recommended' on the menu home, the category being viewed, or null (search). */
  active: CategoryId | 'recommended' | null;
  /** Show the allergy note (menu home). */
  showAllergyNote?: boolean;
}

/** Desktop left column: categories, dietary filters (w02 / w03). */
export function CategorySidebar({ active, showAllergyNote }: CategorySidebarProps) {
  const { filters } = useFilters();
  const { toggleDiet, toggleFlag } = useFilterActions();
  const { categories, categoryCount } = useMenu();
  const { dietary } = useBranch();
  const t = useContent('menu');

  return (
    <aside className={cx(styles.side, 'hide-mobile')} aria-label={t('nav.menuSections')}>
      <div className={styles.sticky}>
        <nav className={styles.cats} aria-label={t('nav.categories')}>
          <Link
            href="/menu/"
            className={cx(styles.cat, active === 'recommended' && styles.on)}
            aria-current={active === 'recommended' ? 'page' : undefined}
          >
            {t('sort.recommended')}
            <Icon name="chef" size="xs" />
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={
                cat.id === 'starters' && active === 'recommended' ? '#starters' : `/menu/${cat.id}/`
              }
              className={cx(styles.cat, active === cat.id && styles.on)}
              aria-current={active === cat.id ? 'page' : undefined}
            >
              {cat.name}
              <span className={styles.n}>{categoryCount(cat.id)}</span>
            </Link>
          ))}
        </nav>
        <hr className={styles.hr} />
        <div className={styles.diet} role="group" aria-labelledby="diet-title">
          <span id="diet-title" className={cx('t-caption c3', styles.dietTitle)}>
            {t('filters.dietary')}
          </span>
          {dietary.marks.map((mark) => (
            <DietCheck
              key={mark}
              label={t(`filters.diet.${mark}.only`)}
              checked={filters.diet === mark}
              onToggle={() => toggleDiet(mark)}
            >
              <VegMark veg={isVegMark(mark)} decorative />
            </DietCheck>
          ))}
          <DietCheck
            label={t('filters.spicy')}
            checked={filters.spicy}
            onToggle={() => toggleFlag('spicy')}
          >
            <Icon name="flame" size="xs" className={styles.flame} />
          </DietCheck>
        </div>
        {showAllergyNote && (
          <div className={styles.well}>
            <span className="t-small">
              <b>{t('sidebar.allergyTitle')}</b>
            </span>
            <span className="t-small c2">{t('sidebar.allergyNote')}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

function DietCheck({
  label,
  checked,
  onToggle,
  children,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={styles.check}
      onClick={onToggle}
    >
      <span className={cx(styles.box, checked && styles.boxOn)} aria-hidden="true" />
      {children}
      {label}
    </button>
  );
}

export interface SearchSidebarProps {
  counts: { id: CategoryId | 'all'; label: string; count: number }[];
  active: CategoryId | 'all';
  onSelect: (id: CategoryId | 'all') => void;
}

/** Desktop search refinement: "Found in" categories (w05). */
export function SearchSidebar({ counts, active, onSelect }: SearchSidebarProps) {
  const t = useContent('menu');
  return (
    <aside className={cx(styles.side, 'hide-mobile')} aria-label={t('sidebar.refineResults')}>
      <div className={styles.sticky}>
        <span id="found-in" className={cx('t-caption c3', styles.foundIn)}>
          {t('sidebar.foundIn')}
        </span>
        <div className={styles.cats} role="group" aria-labelledby="found-in">
          {counts.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cx(styles.cat, active === c.id && styles.on)}
              aria-pressed={active === c.id}
              onClick={() => onSelect(c.id)}
            >
              {c.label}
              <span className={styles.n}>{c.count}</span>
            </button>
          ))}
        </div>
        <hr className={styles.hr} />
        <Link href="/menu/" className={styles.back}>
          <Icon name="back" size="xs" />
          {t('nav.backToFullMenu')}
        </Link>
      </div>
    </aside>
  );
}
