'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

interface SearchContextValue {
  /** What's in the search box right now. */
  query: string;
  setQuery: (query: string) => void;
  /** `query` after 250 ms without typing — results are computed from this. */
  debouncedQuery: string;
  /** True while typing and the debounced query hasn't caught up. */
  pending: boolean;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/** Shared by the desktop header search box and the search page / mobile search bar. */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const value = useMemo(
    () => ({
      query,
      setQuery,
      debouncedQuery,
      pending: query.trim() !== '' && query.trim() !== debouncedQuery.trim(),
    }),
    [query, debouncedQuery],
  );
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used inside <SearchProvider>');
  return ctx;
}
