'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  SearchField,
  Skeleton,
  Spinner,
} from '@/components/ui';
import { CartBar } from '@/components/layout/CartBar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MenuShell } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { CartPanel } from '@/components/cart/CartPanel';
import { categories } from '@/data/menu';
import { useSearch } from '@/context/SearchContext';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { cx } from '@/lib/cx';
import { searchDishes, sortDishes, type SortKey } from '@/lib/menu';
import type { CategoryId } from '@/types/menu';
import { CategorySidebar, SearchSidebar } from './CategorySidebar';
import { DishList } from './DishList';
import { SearchSuggestions } from './SearchSuggestions';
import { SortMenu } from './SortMenu';
import styles from './SearchView.module.css';

const EMPTY_CATS: CategoryId[] = ['starters', 'mains', 'desserts', 'beverages'];

/** Search: suggestions, loading, results, no results (04 · 05 · s04 · s05 · w04–ws05). */
export function SearchView() {
  const router = useRouter();
  const { query, setQuery, debouncedQuery, pending } = useSearch();
  const { add } = useRecentSearches();
  const [sort, setSort] = useState<SortKey>('best-match');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const synced = useRef(false);

  // Seed the box from ?q= once, then mirror the debounced query back into the URL.
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
  }, [setQuery]);

  useEffect(() => {
    if (!synced.current) return;
    const q = debouncedQuery.trim();
    const current = new URLSearchParams(window.location.search).get('q') ?? '';
    if (q === current) return;
    router.replace(q ? `/search/?q=${encodeURIComponent(q)}` : '/search/', { scroll: false });
  }, [debouncedQuery, router]);

  const term = debouncedQuery.trim();
  const results = useMemo(() => searchDishes(term), [term]);
  const counts = useMemo(() => {
    const byCat = categories
      .map((c) => ({
        id: c.id,
        label: c.name,
        count: results.filter((d) => d.categoryId === c.id).length,
      }))
      .filter((c) => c.count > 0);
    return [{ id: 'all' as const, label: 'All results', count: results.length }, ...byCat];
  }, [results]);
  const activeCat = counts.some((c) => c.id === cat) ? cat : 'all';
  const shown = sortDishes(
    activeCat === 'all' ? results : results.filter((d) => d.categoryId === activeCat),
    sort === 'best-match' ? 'best-match' : sort,
  );

  const state: 'suggest' | 'loading' | 'results' | 'empty' =
    query.trim() === '' ? 'suggest' : pending ? 'loading' : results.length ? 'results' : 'empty';

  const pick = (t: string) => {
    setQuery(t);
    add(t);
  };
  const plural = shown.length === 1 ? 'dish' : 'dishes';

  return (
    <>
      <SiteHeader />
      <MobileHeader variant="topbar" hideTable className={styles.bar}>
        <IconButton
          icon="back"
          label={query ? 'Back' : 'Close search'}
          onClick={() => (query ? setQuery('') : router.push('/menu/'))}
        />
        <SearchField
          id="mobile-search"
          className={styles.field}
          value={query}
          onChange={setQuery}
          onSubmit={(v) => add(v)}
          autoFocus={!query}
          trailing={pending ? <Spinner tone="brand" /> : undefined}
        />
      </MobileHeader>

      <MenuShell
        tight
        mainProps={{ 'aria-busy': state === 'loading' }}
        sidebar={
          state === 'results' ? (
            <SearchSidebar counts={counts} active={activeCat} onSelect={setCat} />
          ) : state === 'loading' ? (
            <aside className="hide-mobile" aria-hidden="true" />
          ) : (
            <CategorySidebar active={null} />
          )
        }
        cart={<CartPanel />}
      >
        <h1 className="visually-hidden">Search the menu</h1>

        {state === 'suggest' && (
          <div className={styles.suggest}>
            <SearchSuggestions onPick={pick} />
          </div>
        )}

        {state === 'loading' && (
          <div className={styles.skeleton} aria-label="Searching">
            <Skeleton width={140} height={14} className={styles.skTitle} />
            <div className={styles.skGrid}>
              {[180, 150, 200, 160].map((w, i) => (
                <div key={i} className={styles.skRow}>
                  <div className={styles.skLines}>
                    <Skeleton width={60} height={12} />
                    <Skeleton width={w} height={16} />
                    <Skeleton width={56} height={14} />
                    <Skeleton width="90%" height={12} />
                  </div>
                  {i % 2 === 0 ? (
                    <Skeleton shape="block" width={116} height={108} />
                  ) : (
                    <Skeleton shape="block" width={84} height={40} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {state === 'results' && (
          <div className={styles.results}>
            <div
              className={cx(styles.chips, 'hide-desktop')}
              role="group"
              aria-label="Filter results"
            >
              {counts.map((c) => (
                <Chip key={c.id} pressed={activeCat === c.id} onClick={() => setCat(c.id)}>
                  {c.id === 'all' ? `All ${c.count}` : c.label}
                </Chip>
              ))}
            </div>
            <p className="t-small c2 hide-desktop" aria-live="polite">
              {shown.length} {plural} match <b className={styles.q}>“{term}”</b>
            </p>
            <div className={cx(styles.head, 'hide-mobile')}>
              <h2 className="t-h1" aria-live="polite">
                {shown.length} {plural} for “{term}”
              </h2>
              <SortMenu
                value={sort}
                onChange={setSort}
                options={['best-match', 'price-asc', 'price-desc']}
                alignEnd
              />
            </div>
          </div>
        )}
        {state === 'results' && (
          <div
            className={styles.list}
            onClickCapture={(e) => {
              if ((e.target as HTMLElement).closest('a')) add(term);
            }}
          >
            <DishList dishes={shown} label="Search results" query={term} searchResult />
          </div>
        )}

        {state === 'empty' && (
          <div className={styles.empty} role="status">
            <EmptyState
              icon="search"
              tone="neutral"
              title="No dishes found"
              titleClassName={styles.emptyTitle}
              actions={
                <>
                  <div className={styles.emptyChips}>
                    {EMPTY_CATS.map((id) => (
                      <Chip key={id} href={`/menu/${id}/`}>
                        {categories.find((c) => c.id === id)?.name}
                      </Chip>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    className={styles.clearBtn}
                    onClick={() => setQuery('')}
                  >
                    Clear search
                  </Button>
                </>
              }
            >
              We couldn&apos;t find anything for “{term}”. Try searching for something else, or
              browse a category.
            </EmptyState>
          </div>
        )}
      </MenuShell>
      {state === 'results' && <CartBar noNav />}
    </>
  );
}
