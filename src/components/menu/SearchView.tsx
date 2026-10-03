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
import { OrderingBanner } from '@/components/status/OrderingBanner';
import { CartPanel } from '@/components/cart/CartPanel';
import { useContent, useMenu } from '@/api/hooks';
import { useSearch } from '@/context/SearchContext';
import { cx } from '@/lib/cx';
import { sortDishes, type SortKey } from '@/lib/menu';
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
  const menu = useMenu();
  const t = useContent('menu');
  const { query, setQuery, debouncedQuery, pending } = useSearch();
  const [sort, setSort] = useState<SortKey>('best-match');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  // The ?q= of a deep link, held until the box (and its debounce) has picked it up.
  const seed = useRef<{ q: string; applied: boolean } | null | undefined>(undefined);

  // Seed the box from ?q= once, then mirror the debounced query back into the URL.
  useEffect(() => {
    if (seed.current === undefined) {
      const q = new URLSearchParams(window.location.search).get('q');
      seed.current = q ? { q, applied: false } : null;
      if (q) setQuery(q);
    }
    const held = seed.current;
    if (held) {
      if (query === held.q) held.applied = true;
      // Never write the URL before the seeded term has reached the results.
      if (!held.applied || (query === held.q && debouncedQuery !== held.q)) return;
      seed.current = null;
    }
    if (query !== debouncedQuery) return;
    const q = debouncedQuery.trim();
    const current = new URLSearchParams(window.location.search).get('q') ?? '';
    if (q === current) return;
    router.replace(q ? `/search/?q=${encodeURIComponent(q)}` : '/search/', { scroll: false });
  }, [query, debouncedQuery, router, setQuery]);

  const term = debouncedQuery.trim();
  const results = useMemo(() => menu.searchDishes(term), [menu, term]);
  const counts = useMemo(() => {
    const byCat = menu.categories
      .map((c) => ({
        id: c.id,
        label: c.name,
        count: results.filter((d) => d.categoryId === c.id).length,
      }))
      .filter((c) => c.count > 0);
    return [{ id: 'all' as const, label: t('search.allResults'), count: results.length }, ...byCat];
  }, [menu, results, t]);
  const activeCat = counts.some((c) => c.id === cat) ? cat : 'all';
  const shown = useMemo(
    () =>
      sortDishes(
        activeCat === 'all' ? results : results.filter((d) => d.categoryId === activeCat),
        sort,
      ),
    [results, activeCat, sort],
  );

  const state: 'suggest' | 'loading' | 'results' | 'empty' =
    query.trim() === '' ? 'suggest' : pending ? 'loading' : results.length ? 'results' : 'empty';

  const pick = (term: string) => setQuery(term);
  const dishes = t.plural('search.dishCount', shown.length);

  return (
    <>
      <SiteHeader />
      <MobileHeader variant="topbar" hideTable className={styles.bar}>
        <IconButton
          icon="back"
          label={query ? t('search.back') : t('search.close')}
          onClick={() => (query ? setQuery('') : router.push('/menu/'))}
        />
        <SearchField
          id="mobile-search"
          className={styles.field}
          value={query}
          onChange={setQuery}
          autoFocus={!query}
          trailing={pending ? <Spinner tone="brand" /> : undefined}
        />
      </MobileHeader>
      <OrderingBanner />

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
        <h1 className="visually-hidden">{t('search.heading')}</h1>

        {state === 'suggest' && (
          <div className={styles.suggest}>
            <SearchSuggestions onPick={pick} />
          </div>
        )}

        {state === 'loading' && (
          <div className={styles.skeleton} aria-label={t('search.searching')}>
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
              aria-label={t('search.filterResults')}
            >
              {counts.map((c) => (
                <Chip key={c.id} pressed={activeCat === c.id} onClick={() => setCat(c.id)}>
                  {c.id === 'all' ? t('search.allCount', { count: c.count }) : c.label}
                </Chip>
              ))}
            </div>
            <p className="t-small c2 hide-desktop" aria-live="polite">
              {t.rich(
                'search.match',
                { b: (chunks) => <b className={styles.q}>{chunks}</b> },
                { dishes, term },
              )}
            </p>
            <div className={cx(styles.head, 'hide-mobile')}>
              <h2 className="t-h1" aria-live="polite">
                {t('search.resultsFor', { dishes, term })}
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
          <div className={styles.list}>
            <DishList dishes={shown} label={t('search.resultsLabel')} query={term} searchResult />
          </div>
        )}

        {state === 'empty' && (
          <div className={styles.empty} role="status">
            <EmptyState
              icon="search"
              tone="neutral"
              title={t('search.emptyTitle')}
              titleClassName={styles.emptyTitle}
              actions={
                <>
                  <div className={styles.emptyChips}>
                    {EMPTY_CATS.map((id) => (
                      <Chip key={id} href={`/menu/${id}/`}>
                        {menu.getCategory(id)?.name}
                      </Chip>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    className={styles.clearBtn}
                    onClick={() => setQuery('')}
                  >
                    {t('search.clear')}
                  </Button>
                </>
              }
            >
              {t('search.emptyBody', { term })}
            </EmptyState>
          </div>
        )}
      </MenuShell>
      {state === 'results' && <CartBar noNav />}
    </>
  );
}
