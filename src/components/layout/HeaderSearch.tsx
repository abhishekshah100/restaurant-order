'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '@/api/hooks';
import { SearchField, Spinner } from '@/components/ui';
import { SearchSuggestions } from '@/components/menu/SearchSuggestions';
import { useSearch } from '@/context/SearchContext';
import { useHydrated } from '@/hooks/useHydrated';
import { cx } from '@/lib/cx';
import styles from './HeaderSearch.module.css';

/**
 * Desktop header search. Focus on an empty box opens suggestions over a scrim (w04);
 * typing jumps to /search and results update as you type (w05). The suggestions are a
 * plain region of links after the field (Tab reaches them), not a combobox popup.
 */
export function HeaderSearch() {
  const t = useContent('common');
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { query, setQuery, pending } = useSearch();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSearchPage = pathname.startsWith('/search');
  const showDropdown = open && query.trim() === '';
  // Set once a push to /search is under way, so typing doesn't stack history entries.
  const navigating = useRef(false);

  useEffect(() => {
    navigating.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!showDropdown) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [showDropdown]);

  const goToSearch = () => {
    if (onSearchPage || navigating.current) return;
    navigating.current = true;
    router.push('/search/');
  };

  const pick = (term: string) => {
    setQuery(term);
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
        aria-controls={showDropdown ? 'header-search-suggestions' : undefined}
        onFocus={() => setOpen(true)}
        onChange={(value) => {
          setQuery(value);
          if (value.trim()) goToSearch();
        }}
        onSubmit={() => {
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
          aria-label={t('search.suggestions')}
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
