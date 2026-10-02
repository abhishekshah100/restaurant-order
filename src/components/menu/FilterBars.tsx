'use client';

import { Chip } from '@/components/ui';
import { useFilters } from '@/context/FiltersContext';
import { cx } from '@/lib/cx';
import { PRICE_LIMIT, type Diet } from '@/lib/menu';
import { formatINR } from '@/lib/format';
import { SortMenu } from './SortMenu';
import styles from './FilterBars.module.css';

/** Mobile menu-home chips: All · Veg · Non-veg · Chef's picks · Spicy (02). */
export function MenuFilterChips() {
  const { filters, setFilters, reset } = useFilters();
  const none = filters.diet === 'all' && !filters.chefs && !filters.spicy && !filters.under400;
  const diet = (d: Diet) => setFilters((f) => ({ ...f, diet: f.diet === d ? 'all' : d }));
  return (
    <div className={cx(styles.row, 'hide-desktop')} role="group" aria-label="Filters">
      <Chip pressed={none} onClick={reset}>
        All
      </Chip>
      <Chip veg pressed={filters.diet === 'veg'} onClick={() => diet('veg')}>
        Veg
      </Chip>
      <Chip veg={false} pressed={filters.diet === 'nonveg'} onClick={() => diet('nonveg')}>
        Non-veg
      </Chip>
      <Chip
        iconStart="chef"
        pressed={filters.chefs}
        onClick={() => setFilters((f) => ({ ...f, chefs: !f.chefs }))}
      >
        Chef&apos;s picks
      </Chip>
      <Chip
        iconStart="flame"
        pressed={filters.spicy}
        onClick={() => setFilters((f) => ({ ...f, spicy: !f.spicy }))}
      >
        Spicy
      </Chip>
    </div>
  );
}

const under = `Under ${formatINR(PRICE_LIMIT)}`;

/** Mobile category chips: Sort · Veg · Non-veg · Under ₹400 (03). */
export function CategoryFilterChips() {
  const { filters, setFilters, sort, setSort } = useFilters();
  const diet = (d: Diet) => setFilters((f) => ({ ...f, diet: f.diet === d ? 'all' : d }));
  return (
    <div className={cx(styles.row, 'hide-desktop')} role="group" aria-label="Filter and sort">
      <SortMenu value={sort} onChange={setSort} presentation="sheet" />
      <Chip
        veg
        pressed={filters.diet === 'veg'}
        iconEnd={filters.diet === 'veg' ? 'x' : undefined}
        onClick={() => diet('veg')}
      >
        Veg
      </Chip>
      <Chip
        veg={false}
        pressed={filters.diet === 'nonveg'}
        iconEnd={filters.diet === 'nonveg' ? 'x' : undefined}
        onClick={() => diet('nonveg')}
      >
        Non-veg
      </Chip>
      <Chip
        pressed={filters.under400}
        iconEnd={filters.under400 ? 'x' : undefined}
        onClick={() => setFilters((f) => ({ ...f, under400: !f.under400 }))}
      >
        {under}
      </Chip>
    </div>
  );
}

/** Desktop category controls beside the title: Sort · Under ₹400 (w03). */
export function CategoryDesktopActions() {
  const { filters, setFilters, sort, setSort } = useFilters();
  return (
    <div className={cx(styles.desktopActions, 'hide-mobile')}>
      <SortMenu value={sort} onChange={setSort} alignEnd />
      <Chip
        pressed={filters.under400}
        iconEnd={filters.under400 ? 'x' : undefined}
        onClick={() => setFilters((f) => ({ ...f, under400: !f.under400 }))}
      >
        {under}
      </Chip>
    </div>
  );
}

/** Desktop "Veg only ×" chip for the active sidebar filter, plus the result count (w03). */
export function ActiveFilterRow({ summary }: { summary: string }) {
  const { filters, setFilters } = useFilters();
  const chips = [
    filters.diet === 'veg' && {
      key: 'veg',
      label: 'Veg only',
      veg: true,
      clear: () => setFilters((f) => ({ ...f, diet: 'all' })),
    },
    filters.diet === 'nonveg' && {
      key: 'nv',
      label: 'Non-veg only',
      veg: false,
      clear: () => setFilters((f) => ({ ...f, diet: 'all' })),
    },
    filters.spicy && {
      key: 'spicy',
      label: 'Spicy',
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
          aria-label={`Remove filter: ${c.label}`}
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
