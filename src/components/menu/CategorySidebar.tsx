'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, VegMark } from '@/components/ui';
import { categories } from '@/data/menu';
import { useFilters } from '@/context/FiltersContext';
import { cx } from '@/lib/cx';
import { categoryCount } from '@/lib/menu';
import type { CategoryId } from '@/types/menu';
import styles from './CategorySidebar.module.css';

export interface CategorySidebarProps {
  /** 'recommended' on the menu home, the category being viewed, or null (search). */
  active: CategoryId | 'recommended' | null;
  /** Show the allergy note (menu home). */
  showAllergyNote?: boolean;
}

/** Desktop left column: categories, dietary filters (w02 / w03). */
export function CategorySidebar({ active, showAllergyNote }: CategorySidebarProps) {
  const { filters, setFilters } = useFilters();

  const toggleDiet = (diet: 'veg' | 'nonveg') =>
    setFilters((f) => ({ ...f, diet: f.diet === diet ? 'all' : diet }));

  return (
    <aside className={cx(styles.side, 'hide-mobile')} aria-label="Menu sections">
      <div className={styles.sticky}>
        <nav className={styles.cats} aria-label="Categories">
          <Link
            href="/menu/"
            className={cx(styles.cat, active === 'recommended' && styles.on)}
            aria-current={active === 'recommended' ? 'page' : undefined}
          >
            Recommended
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
            Dietary
          </span>
          <DietCheck
            label="Veg only"
            checked={filters.diet === 'veg'}
            onToggle={() => toggleDiet('veg')}
          >
            <VegMark veg decorative />
          </DietCheck>
          <DietCheck
            label="Non-veg only"
            checked={filters.diet === 'nonveg'}
            onToggle={() => toggleDiet('nonveg')}
          >
            <VegMark veg={false} decorative />
          </DietCheck>
          <DietCheck
            label="Spicy"
            checked={filters.spicy}
            onToggle={() => setFilters((f) => ({ ...f, spicy: !f.spicy }))}
          >
            <Icon name="flame" size="xs" className={styles.flame} />
          </DietCheck>
        </div>
        {showAllergyNote && (
          <div className={styles.well}>
            <span className="t-small">
              <b>Allergies?</b>
            </span>
            <span className="t-small c2">
              Each dish lists its allergens. Your server can help too.
            </span>
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
      className={cx(styles.check, checked && styles.checkOn)}
      onClick={onToggle}
    >
      <span className={styles.box} aria-hidden="true" />
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
  return (
    <aside className={cx(styles.side, 'hide-mobile')} aria-label="Refine results">
      <div className={styles.sticky}>
        <span id="found-in" className={cx('t-caption c3', styles.foundIn)}>
          Found in
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
          Back to full menu
        </Link>
      </div>
    </aside>
  );
}
