'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SearchField, Spinner } from '@/components/ui';
import { SearchSuggestions } from '@/components/menu/SearchSuggestions';
import { useSearch } from '@/context/SearchContext';
import { useHydrated } from '@/hooks/useHydrated';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { cx } from '@/lib/cx';
import styles from './HeaderSearch.module.css';

/**
 * Desktop header search. Focus on an empty box opens suggestions over a scrim (w04);
 * typing jumps to /search and results update as you type (w05).
 */
export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { query, setQuery, pending } = useSearch();
  const { add } = useRecentSearches();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSearchPage = pathname.startsWith('/search');
  const showDropdown = open && query.trim() === '';

  useEffect(() => {
    if (!showDropdown) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [showDropdown]);

  const goToSearch = () => {
    if (!onSearchPage) router.push('/search/');
  };

  const pick = (term: string) => {
    setQuery(term);
    add(term);
    setOpen(false);
    goToSearch();
  };

  return (
    <div ref={rootRef} className={cx(styles.root, showDropdown && styles.open)}>
      <SearchField
        ref={inputRef}
        id="header-search"
        className={styles.field}
        value={query}
        showEscHint={showDropdown}
        trailing={pending ? <Spinner tone="brand" className={styles.spinner} /> : undefined}
        aria-expanded={showDropdown}
        aria-controls="header-search-suggestions"
        onFocus={() => setOpen(true)}
        onChange={(value) => {
          setQuery(value);
          if (value.trim()) goToSearch();
        }}
        onSubmit={(value) => {
          add(value);
          setOpen(false);
          goToSearch();
        }}
        onEscape={() => {
          setOpen(false);
          inputRef.current?.blur();
        }}
      />
      {showDropdown && (
        <div
          id="header-search-suggestions"
          className={styles.dropdown}
          aria-label="Search suggestions"
          role="region"
        >
          <SearchSuggestions compact onPick={pick} onNavigate={() => setOpen(false)} />
        </div>
      )}
      {showDropdown &&
        hydrated &&
        createPortal(
          <div className={styles.scrim} aria-hidden="true" onClick={() => setOpen(false)} />,
          document.body,
        )}
    </div>
  );
}
