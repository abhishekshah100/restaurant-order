'use client';

import dynamic from 'next/dynamic';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useState } from 'react';
import { useBranchMenu } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import { useReorderDishes, useSetDishAvailability } from '@/api/mutations';
import { Button, Chip, EmptyState, Icon, SearchField } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  MENU_STATUS_FILTERS,
  menuCounts,
  menuSections,
  moveItem,
  type MenuStatusFilter,
} from '@/lib/adminMenu';
import type { CategoryId, Dish } from '@/types/menu';
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
const DishEditor = dynamic(() => import('./DishEditor').then((m) => m.DishEditor), {
  ssr: false,
  loading: () => <LoadingSignal />,
});

type Open =
  | { kind: 'availability'; dish: Dish; offFirst: boolean }
  | { kind: 'edit'; dish?: Dish }
  | { kind: 'categories' }
  | null;

/**
 * /admin/dashboard/menu/: the branch's menu for every member of staff. Filter by state (with
 * counts), search, pick a category; a row per dish with its sizes, prices and state. The switch
 * takes a dish off (sold out, until a time, or off today) or puts it back at once; Edit and Add
 * dish open the dish editor. With a category picked, Reorder moves its dishes up and down;
 * Categories renames and reorders them. Changes reach guests' menus within a minute. Read from
 * GET /branches/:id/menu.
 */
export function MenuBoard() {
  const t = useContent('common');
  const { branch, region } = useAdminWorkspace();
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
    // Reordering needs one whole category: picked, not searched or filtered.
    const canReorder = category !== 'all' && !query.trim() && status === 'all';
    content = (
      <>
        <div className={styles.top}>
          <div className={styles.filters} role="group" aria-label={t('adminMenu.filters.label')}>
            {MENU_STATUS_FILTERS.map((f) => (
              <Chip key={f} pressed={status === f} count={counts[f]} onClick={() => setStatus(f)}>
                {t(`adminMenu.filters.${f}`)}
              </Chip>
            ))}
          </div>
          <div className={styles.actions}>
            {order ? (
              <>
                <Button variant="secondary" onClick={() => setOrder(null)}>
                  {t('adminMenu.reorderCancel')}
                </Button>
                <Button iconStart="check" loading={reorderDishes.isPending} onClick={saveOrder}>
                  {t('adminMenu.reorderDone')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setOpen({ kind: 'categories' })}>
                  {t('adminMenu.categoriesButton')}
                </Button>
                <Button
                  variant="secondary"
                  iconStart="sort"
                  disabled={!canReorder}
                  title={canReorder ? undefined : t('adminMenu.reorderHint')}
                  onClick={() =>
                    category !== 'all' && setOrder(menu.dishesIn(category).map((d) => d.slug))
                  }
                >
                  {t('adminMenu.reorder')}
                </Button>
                <Button iconStart="plus" onClick={() => setOpen({ kind: 'edit' })}>
                  {t('adminMenu.addDish')}
                </Button>
              </>
            )}
          </div>
        </div>

        <section className={styles.panel} aria-label={t('adminMenu.title')}>
          <div className={styles.tools}>
            <SearchField
              value={query}
              onChange={setQuery}
              label={t('adminMenu.search')}
              placeholder={t('adminMenu.search')}
            />
            {!query.trim() && (
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
            sections.map((section) => (
              <section
                key={section.id}
                className={styles.section}
                aria-label={section.name || undefined}
              >
                {section.name && (
                  <h2 className={styles.sectionTitle}>
                    {section.name}
                    <span className={styles.sectionCount}>{section.dishes.length}</span>
                  </h2>
                )}
                <ul className={styles.list}>
                  {section.dishes.map((dish) => (
                    <MenuDishRow
                      key={dish.slug}
                      dish={dish}
                      onSwitch={(on) => onSwitch(dish, on)}
                      onAvailability={() =>
                        setOpen({ kind: 'availability', dish, offFirst: false })
                      }
                      onEdit={() => setOpen({ kind: 'edit', dish })}
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
        {open?.kind === 'categories' && (
          <CategoriesDialog categories={menu.categories} onClose={() => setOpen(null)} />
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
