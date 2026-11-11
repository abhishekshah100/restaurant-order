'use client';

import dynamic from 'next/dynamic';
import { isBackendEnabled } from '@/api/backend';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useState } from 'react';
import { useBranchMenu } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import { useReorderDishes, useSetDishAvailability } from '@/api/mutations';
import { Button, Chip, Dialog, EmptyState, Icon, SearchField } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { menuCounts, menuSections, moveItem, type MenuStatusFilter } from '@/lib/adminMenu';
import type { CategoryId, Dish } from '@/types/menu';
import { OptionsList } from '../OptionsList';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { MenuDishRow } from './MenuDishRow';
import styles from './MenuBoard.module.css';

// Popups: each downloaded the first time it opens.
const AvailabilityDialog = dynamic(
  () => import('./AvailabilityDialog').then((m) => m.AvailabilityDialog),
  {
    ssr: false,
    loading: () => <LoadingSignal />,
  },
);
const CategoriesDialog = dynamic(
  () => import('./CategoriesDialog').then((m) => m.CategoriesDialog),
  {
    ssr: false,
    loading: () => <LoadingSignal />,
  },
);
const SearchSuggestionsDialog = dynamic(
  () => import('./SearchSuggestionsDialog').then((m) => m.SearchSuggestionsDialog),
  {
    ssr: false,
    loading: () => <LoadingSignal />,
  },
);
const RecipeDialog = dynamic(
  () => import('../inventory/RecipeDialog').then((m) => m.RecipeDialog),
  { ssr: false },
);
const DishEditor = dynamic(() => import('./DishEditor').then((m) => m.DishEditor), {
  ssr: false,
  loading: () => <LoadingSignal />,
});

type Open =
  | { kind: 'availability'; dish: Dish; offFirst: boolean }
  | { kind: 'edit'; dish?: Dish }
  | { kind: 'recipe'; slug: string }
  | { kind: 'categories' }
  | { kind: 'suggestions' }
  | { kind: 'more' }
  | null;

/** The states the summary line counts (each taps to show only those dishes). */
const STATES = ['available', 'soldOut', 'offToday'] as const;

/**
 * /admin/dashboard/menu/: the branch's menu for every member of staff. A summary line ("56
 * dishes · 54 available · 1 sold out"; each state taps to show only those), Categories, More
 * (search suggestions, reorder a category's dishes) and Add dish; then search and the category
 * chips, and a row per dish: one switch with its state in words, tap the dish to edit. A simple
 * menu (one category) shows no categories at all: one list. Changes reach guests' menus within
 * a minute. Read from GET /branches/:id/menu.
 */
export function MenuBoard() {
  const t = useContent('common');
  const { branch, region, can } = useAdminWorkspace();
  // Adding, changing and ordering dishes; the rest only switch what's in stock.
  const manage = can('menu.manage');
  // Recipes need the server (the mock keeps no stock) and the inventory manager's permission.
  const recipes = isBackendEnabled() && can('inventory.manage');
  const { menu, error } = useBranchMenu(region);
  const [status, setStatus] = useState<MenuStatusFilter>('all');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Open>(null);
  /** While reordering a category: its dishes' slugs in the new order. */
  const [order, setOrder] = useState<string[] | null>(null);
  const { showToast } = useToast();
  const setAvailability = useSetDishAvailability();
  const reorderDishes = useReorderDishes();

  const saveOrder = () => {
    if (!order || category === 'all') return;
    reorderDishes.mutate(
      { branchId: branch.id, categoryId: category, slugs: order },
      {
        onSuccess: () => {
          setOrder(null);
          showToast(t('adminMenu.reordered'), { tone: 'success' });
        },
        onError: () => showToast(t('adminMenu.failed'), { tone: 'error' }),
      },
    );
  };

  const onSwitch = (dish: Dish, on: boolean) => {
    if (!on) {
      setOpen({ kind: 'availability', dish, offFirst: true });
      return;
    }
    setAvailability.mutate(
      { branchId: branch.id, slug: dish.slug, body: { availability: { status: 'available' } } },
      {
        onSuccess: () =>
          showToast(t('adminMenu.availability.toast.available', { dish: dish.name }), {
            tone: 'success',
          }),
        onError: () => showToast(t('adminMenu.failed'), { tone: 'error' }),
      },
    );
  };

  let content;
  if (menu) {
    const counts = menuCounts(menu.dishes);
    const sections = order
      ? [
          {
            id: 'reorder',
            name: menu.getCategory(category)?.name ?? '',
            dishes: order.flatMap((slug) => menu.getDish(slug) ?? []),
          },
        ]
      : menuSections(menu, { status, category, query });
    const simple = menu.categories.length === 1;
    const startReorder = (id: CategoryId) => {
      setStatus('all');
      setQuery('');
      setCategory(id);
      setOrder(menu.dishesIn(id).map((d) => d.slug));
      setOpen(null);
    };
    content = (
      <>
        <div className={styles.top}>
          <div className={styles.summary}>
            <p className={styles.total}>{t.plural('adminMenu.summary.dishes', counts.all)}</p>
            <div className={styles.states} role="group" aria-label={t('adminMenu.filters.label')}>
              {STATES.filter((k) => k === 'available' || counts[k] > 0).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={styles.stateChip}
                  data-state={k}
                  aria-pressed={status === k}
                  onClick={() => setStatus(status === k ? 'all' : k)}
                >
                  <span className={styles.stateDot} aria-hidden="true" />
                  {t.plural(`adminMenu.summary.${k}`, counts[k])}
                </button>
              ))}
              {status !== 'all' && (
                <button type="button" className={styles.showAll} onClick={() => setStatus('all')}>
                  {t('adminMenu.summary.showAll')}
                </button>
              )}
            </div>
          </div>
          <div className={styles.actions}>
            {!manage ? null : order ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setOrder(null)}>
                  {t('adminMenu.reorderCancel')}
                </Button>
                <Button
                  size="sm"
                  iconStart="check"
                  loading={reorderDishes.isPending}
                  onClick={saveOrder}
                >
                  {t('adminMenu.reorderDone')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setOpen({ kind: 'categories' })}
                >
                  {t('adminMenu.categoriesButton')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  iconStart="dots"
                  onClick={() => setOpen({ kind: 'more' })}
                >
                  {t('adminMenu.more')}
                </Button>
                <Button size="sm" iconStart="plus" onClick={() => setOpen({ kind: 'edit' })}>
                  {t('adminMenu.addDish')}
                </Button>
              </>
            )}
          </div>
        </div>

        {order && (
          <p className={styles.reordering} role="status">
            <Icon name="sort" size="xs" />
            {t('adminMenu.reordering', { name: menu.getCategory(category)?.name ?? '' })}
          </p>
        )}

        <section className={styles.panel} aria-label={t('adminMenu.title')}>
          <div className={styles.tools}>
            <SearchField
              value={query}
              onChange={setQuery}
              label={t('adminMenu.search')}
              placeholder={t('adminMenu.search')}
            />
            {!query.trim() && !simple && !order && (
              <div
                className={styles.categories}
                role="group"
                aria-label={t('adminMenu.categories')}
              >
                <Chip pressed={category === 'all'} onClick={() => setCategory('all')}>
                  {t('adminMenu.allCategories')}
                </Chip>
                {menu.categories.map((c) => (
                  <Chip key={c.id} pressed={category === c.id} onClick={() => setCategory(c.id)}>
                    {c.shortName ?? c.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          {sections.length > 0 ? (
            sections.map((section, sectionIndex) => (
              <section
                key={section.id}
                className={styles.section}
                aria-label={section.name || undefined}
              >
                {section.name && !simple && (
                  <h2 className={styles.sectionTitle}>
                    {section.name}
                    <span className={styles.sectionCount}>{section.dishes.length}</span>
                  </h2>
                )}
                <ul className={styles.list}>
                  {section.dishes.map((dish, i) => (
                    <MenuDishRow
                      key={dish.slug}
                      dish={dish}
                      // The first section's first rows are near the top of the page.
                      eager={sectionIndex === 0 && i < 6}
                      onSwitch={(on) => onSwitch(dish, on)}
                      onAvailability={() =>
                        setOpen({ kind: 'availability', dish, offFirst: false })
                      }
                      onEdit={manage ? () => setOpen({ kind: 'edit', dish }) : undefined}
                      onRecipe={
                        recipes ? () => setOpen({ kind: 'recipe', slug: dish.slug }) : undefined
                      }
                      reorder={
                        order
                          ? {
                              first: order[0] === dish.slug,
                              last: order.at(-1) === dish.slug,
                              onMove: (by) =>
                                setOrder(moveItem(order, order.indexOf(dish.slug), by)),
                            }
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <Icon name="menu" size="md" />
              </span>
              <p className={styles.emptyTitle}>{t('adminMenu.empty.title')}</p>
              <p className={styles.emptyBody}>
                {query.trim()
                  ? t('adminMenu.empty.search', { query: query.trim() })
                  : t('adminMenu.empty.filter')}
              </p>
            </div>
          )}
        </section>

        {open?.kind === 'availability' && (
          <AvailabilityDialog
            dish={open.dish}
            initial={open.offFirst ? 'soldOut' : undefined}
            onClose={() => setOpen(null)}
          />
        )}
        {open?.kind === 'recipe' && <RecipeDialog slug={open.slug} onClose={() => setOpen(null)} />}
        {open?.kind === 'categories' && (
          <CategoriesDialog menu={menu} onClose={() => setOpen(null)} />
        )}
        {open?.kind === 'more' && (
          <Dialog
            open
            onClose={() => setOpen(null)}
            presentation="adaptive"
            title={t('adminMenu.moreTitle')}
            className={styles.moreDialog}
          >
            <OptionsList
              items={[
                {
                  key: 'suggestions',
                  icon: 'search',
                  title: t('adminMenu.moreItems.suggestions.title'),
                  body: t('adminMenu.moreItems.suggestions.body'),
                  onSelect: () => setOpen({ kind: 'suggestions' }),
                },
                simple
                  ? {
                      key: 'reorder',
                      icon: 'sort',
                      title: t('adminMenu.moreItems.reorder.title'),
                      body: t('adminMenu.moreItems.reorder.bodySimple'),
                      onSelect: () => startReorder(menu.categories[0].id),
                    }
                  : {
                      key: 'reorder',
                      icon: 'sort',
                      title: t('adminMenu.moreItems.reorder.title'),
                      body: t('adminMenu.moreItems.reorder.body'),
                      extra: menu.categories.map((c) => (
                        <Chip key={c.id} onClick={() => startReorder(c.id)}>
                          {c.shortName ?? c.name}
                        </Chip>
                      )),
                    },
              ]}
            />
          </Dialog>
        )}
        {open?.kind === 'suggestions' && (
          <SearchSuggestionsDialog menu={menu} onClose={() => setOpen(null)} />
        )}
        {open?.kind === 'edit' && (
          <DishEditor
            menu={menu}
            dish={open.dish}
            category={category === 'all' ? menu.categories[0].id : category}
            onClose={() => setOpen(null)}
          />
        )}
      </>
    );
  } else if (error) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminHome.error.title')}
        className={styles.state}
      >
        {t('adminHome.error.body')}
      </EmptyState>
    );
  } else {
    content = <div className={styles.skeleton} role="status" aria-label={t('adminMenu.loading')} />;
  }

  return (
    <div className={styles.page}>
      {/* The bar above already names the page; the heading is for screen readers. */}
      <h1 className="visually-hidden">{t('adminMenu.title')}</h1>
      {content}
    </div>
  );
}
