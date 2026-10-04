'use client';

import { Chip } from '@/components/ui';
import { useBranch, useContent, useMenu, useRegion } from '@/api/hooks';
import { useFilters } from '@/context/FiltersContext';
import { cx } from '@/lib/cx';
import { hasActiveFilters, isVegMark } from '@/lib/menu';
import { SortMenu } from './SortMenu';
import { useFilterActions } from './useFilterActions';
import styles from './FilterBars.module.css';

/** Mobile menu-home chips: All · Veg · Non-veg · Chef's picks · Spicy (02). Diet chips: the branch's marks. */
export function MenuFilterChips() {
  const { filters, reset } = useFilters();
  const { toggleDiet, toggleFlag } = useFilterActions();
  const { dietary } = useBranch();
  const none = !hasActiveFilters(filters);
  const t = useContent('menu');
  return (
    <div className={cx(styles.row, 'hide-desktop')} role="group" aria-label={t('filters.label')}>
      <Chip pressed={none} onClick={reset}>
        {t('filters.all')}
      </Chip>
      {dietary.marks.map((mark) => (
        <Chip
          key={mark}
          veg={isVegMark(mark)}
          pressed={filters.diet === mark}
          onClick={() => toggleDiet(mark)}
        >
          {t(`filters.diet.${mark}.chip`)}
        </Chip>
      ))}
      <Chip iconStart="chef" pressed={filters.chefs} onClick={() => toggleFlag('chefs')}>
        {t('filters.chefsPicks')}
      </Chip>
      <Chip iconStart="flame" pressed={filters.spicy} onClick={() => toggleFlag('spicy')}>
        {t('filters.spicy')}
      </Chip>
    </div>
  );
}

/** "Under {price}": the menu's price filter (GET /branches/:id/menu › priceFilter). */
function UnderPriceChip() {
  const { filters } = useFilters();
  const { toggleFlag } = useFilterActions();
  const { priceFilter } = useMenu();
  const { money } = useRegion();
  const t = useContent('menu');
  return (
    <Chip
      pressed={filters.underPrice}
      iconEnd={filters.underPrice ? 'x' : undefined}
      onClick={() => toggleFlag('underPrice')}
    >
      {t('filters.under', { price: money.format(priceFilter) })}
    </Chip>
  );
}

/** Mobile category chips: Sort · Veg · Non-veg · Under a price (03). */
export function CategoryFilterChips() {
  const { filters, sort, setSort } = useFilters();
  const { toggleDiet } = useFilterActions();
  const { dietary } = useBranch();
  const t = useContent('menu');
  return (
    <div
      className={cx(styles.row, 'hide-desktop')}
      role="group"
      aria-label={t('filters.filterAndSort')}
    >
      <SortMenu value={sort} onChange={setSort} presentation="sheet" />
      {dietary.marks.map((mark) => (
        <Chip
          key={mark}
          veg={isVegMark(mark)}
          pressed={filters.diet === mark}
          iconEnd={filters.diet === mark ? 'x' : undefined}
          onClick={() => toggleDiet(mark)}
        >
          {t(`filters.diet.${mark}.chip`)}
        </Chip>
      ))}
      <UnderPriceChip />
    </div>
  );
}

/** Desktop category controls beside the title: Sort · Under a price (w03). */
export function CategoryDesktopActions() {
  const { sort, setSort } = useFilters();
  return (
    <div className={cx(styles.desktopActions, 'hide-mobile')}>
      <SortMenu value={sort} onChange={setSort} alignEnd />
      <UnderPriceChip />
    </div>
  );
}

/** Desktop "Veg only ×" chip for the active sidebar filter, plus the result count (w03). */
export function ActiveFilterRow({ summary }: { summary: string }) {
  const { filters, setFilters } = useFilters();
  const { setDiet } = useFilterActions();
  const t = useContent('menu');
  const chips = [
    filters.diet !== 'all' && {
      key: filters.diet,
      label: t(`filters.diet.${filters.diet}.only`),
      veg: isVegMark(filters.diet),
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
