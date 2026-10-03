'use client';

import { useMemo } from 'react';
import { useFilters } from '@/context/FiltersContext';
import type { Diet, MenuFilters } from '@/lib/menu';

type FilterFlag = {
  [K in keyof MenuFilters]: MenuFilters[K] extends boolean ? K : never;
}[keyof MenuFilters];

/** The filter changes the menu chips and sidebar make, shared so they behave the same everywhere. */
export function useFilterActions() {
  const { setFilters } = useFilters();
  return useMemo(
    () => ({
      setDiet: (diet: Diet) => setFilters((f) => ({ ...f, diet })),
      /** Veg / non-veg chips: pressing the active one goes back to all dishes. */
      toggleDiet: (diet: Exclude<Diet, 'all'>) =>
        setFilters((f) => ({ ...f, diet: f.diet === diet ? 'all' : diet })),
      toggleFlag: (flag: FilterFlag) => setFilters((f) => ({ ...f, [flag]: !f[flag] })),
    }),
    [setFilters],
  );
}
