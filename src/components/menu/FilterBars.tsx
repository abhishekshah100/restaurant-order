'use client';

import { Chip } from '@/components/ui';
import { useContent } from '@/api/hooks';
import { useFilters } from '@/context/FiltersContext';
import { cx } from '@/lib/cx';
import { PRICE_LIMIT, hasActiveFilters } from '@/lib/menu';
import { formatINR } from '@/lib/format';
import { SortMenu } from './SortMenu';
import { useFilterActions } from './useFilterActions';
import styles from './FilterBars.module.css';

/** Mobile menu-home chips: All · Veg · Non-veg · Chef's picks · Spicy (02). */
export function MenuFilterChips() {
  const { filters, reset } = useFilters();
  const { toggleDiet, toggleFlag } = useFilterActions();
  const none = !hasActiveFilters(filters);
  const t = useContent('menu');
  return (
    <div className={cx(styles.row, 'hide-desktop')} role="group" aria-label={t('filters.label')}>
      <Chip pressed={none} onClick={reset}>
        {t('filters.all')}
      </Chip>
      <Chip veg pressed={filters.diet === 'veg'} onClick={() => toggleDiet('veg')}>
        {t('filters.veg')}
      </Chip>
      <Chip veg={false} pressed={filters.diet === 'nonveg'} onClick={() => toggleDiet('nonveg')}>
        {t('filters.nonVeg')}
      </Chip>
      <Chip iconStart="chef" pressed={filters.chefs} onClick={() => toggleFlag('chefs')}>
        {t('filters.chefsPicks')}
      </Chip>
      <Chip iconStart="flame" pressed={filters.spicy} onClick={() => toggleFlag('spicy')}>
        {t('filters.spicy')}
      </Chip>
    </div>
  );
}

/** Mobile category chips: Sort · Veg · Non-veg · Under ₹400 (03). */
export function CategoryFilterChips() {
  const { filters, sort, setSort } = useFilters();
  const { toggleDiet, toggleFlag } = useFilterActions();
  const t = useContent('menu');
  return (
    <div
      className={cx(styles.row, 'hide-desktop')}
      role="group"
      aria-label={t('filters.filterAndSort')}
    >
      <SortMenu value={sort} onChange={setSort} presentation="sheet" />
      <Chip
        veg
        pressed={filters.diet === 'veg'}
        iconEnd={filters.diet === 'veg' ? 'x' : undefined}
        onClick={() => toggleDiet('veg')}
      >
        {t('filters.veg')}
      </Chip>
      <Chip
        veg={false}
        pressed={filters.diet === 'nonveg'}
        iconEnd={filters.diet === 'nonveg' ? 'x' : undefined}
        onClick={() => toggleDiet('nonveg')}
      >
        {t('filters.nonVeg')}
      </Chip>
      <Chip
        pressed={filters.under400}
        iconEnd={filters.under400 ? 'x' : undefined}
        onClick={() => toggleFlag('under400')}
      >
        {t('filters.under', { price: formatINR(PRICE_LIMIT) })}
      </Chip>
    </div>
  );
}

/** Desktop category controls beside the title: Sort · Under ₹400 (w03). */
export function CategoryDesktopActions() {
  const { filters, sort, setSort } = useFilters();
  const { toggleFlag } = useFilterActions();
  const t = useContent('menu');
  return (
    <div className={cx(styles.desktopActions, 'hide-mobile')}>
      <SortMenu value={sort} onChange={setSort} alignEnd />
      <Chip
        pressed={filters.under400}
        iconEnd={filters.under400 ? 'x' : undefined}
        onClick={() => toggleFlag('under400')}
      >
        {t('filters.under', { price: formatINR(PRICE_LIMIT) })}
      </Chip>
    </div>
  );
}

/** Desktop "Veg only ×" chip for the active sidebar filter, plus the result count (w03). */
export function ActiveFilterRow({ summary }: { summary: string }) {
  const { filters, setFilters } = useFilters();
  const { setDiet } = useFilterActions();
  const t = useContent('menu');
  const chips = [
    filters.diet === 'veg' && {
      key: 'veg',
      label: t('filters.vegOnly'),
      veg: true,
      clear: () => setDiet('all'),
    },
    filters.diet === 'nonveg' && {
      key: 'nv',
      label: t('filters.nonVegOnly'),
      veg: false,
      clear: () => setDiet('all'),
    },
    filters.spicy && {
      key: 'spicy',
      label: t('filters.spicy'),
      veg: undefined,
      clear: () => setFilters((f) => ({ ...f, spicy: false })),
    },
  ].filter(Boolean) as { key: string; label: string; veg?: boolean; clear: () => void }[];

  return (
    <div className={cx(styles.activeRow, 'hide-mobile')}>
      {chips.map((c) => (
        <Chip
          key={c.key}
          veg={c.veg}
          pressed
          iconEnd="x"
          onClick={c.clear}
          aria-label={t('filters.remove', { label: c.label })}
        >
          {c.label}
        </Chip>
      ))}
      <span className="t-small c3" aria-live="polite">
        {summary}
      </span>
    </div>
  );
}
