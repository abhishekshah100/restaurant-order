'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_FILTERS, type MenuFilters, type SortKey } from '@/lib/menu';

interface FiltersContextValue {
  filters: MenuFilters;
  setFilters: (next: MenuFilters | ((prev: MenuFilters) => MenuFilters)) => void;
  sort: SortKey;
  setSort: (sort: SortKey) => void;
  reset: () => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

/** Menu filters and sort, shared across menu, category and search for this visit. */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<MenuFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>('recommended');
  const value = useMemo(
    () => ({
      filters,
      setFilters,
      sort,
      setSort,
      reset: () => {
        setFilters(DEFAULT_FILTERS);
        setSort('recommended');
      },
    }),
    [filters, sort],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used inside <FiltersProvider>');
  return ctx;
}
