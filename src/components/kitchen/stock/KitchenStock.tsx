'use client';

import dynamic from 'next/dynamic';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useState } from 'react';
import { useBranchMenu } from '@/api/adminDashboard';
import { useContent } from '@/api/hooks';
import { useSetDishAvailability } from '@/api/mutations';
import { MenuDishRow } from '@/components/admin/menu/MenuDishRow';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { Chip, EmptyState, Icon, SearchField } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import {
  MENU_STATUS_FILTERS,
  menuCounts,
  menuSections,
  type MenuStatusFilter,
} from '@/lib/adminMenu';
import type { CategoryId, Dish } from '@/types/menu';
import { StatTiles, type StatTile } from '../StatTiles';
import styles from './KitchenStock.module.css';

// Popups: each downloaded the first time it opens.
const AvailabilityDialog = dynamic(
  () => import('@/components/admin/menu/AvailabilityDialog').then((m) => m.AvailabilityDialog),
  {
    ssr: false,
    loading: () => <LoadingSignal />,
  },
);

/**
 * /admin/kitchen-dashboard/stock/: what the kitchen can make. Every dish by station with whether
 * guests can order it; the switch takes one off (sold out, until a time, or off today) or puts
 * it back, and the state opens the same choice with its sizes. The same dishes, dialog and
 * endpoint as the admin Menu page (PATCH …/menu/dishes/:slug/availability), without editing:
 * guests and waiters see the change within a minute, and orders with it are refused.
 */
export function KitchenStock() {
  const t = useContent('kitchen');
  const common = useContent('common');
  const { region, branch } = useAdminWorkspace();
  const { menu, error } = useBranchMenu(region);
  const { showToast } = useToast();
  const setAvailability = useSetDishAvailability();
  const [status, setStatus] = useState<MenuStatusFilter>('all');
  const [station, setStation] = useState<CategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<{ dish: Dish; offFirst: boolean } | null>(null);

  // Off: ask how (sold out, until when, off today). On: back on the menu at once.
  const onSwitch = (dish: Dish, on: boolean) => {
    if (!on) {
      setOpen({ dish, offFirst: true });
      return;
    }
    setAvailability.mutate(
      { branchId: branch.id, slug: dish.slug, body: { availability: { status: 'available' } } },
      {
        onSuccess: () =>
          showToast(common('adminMenu.availability.toast.available', { dish: dish.name }), {
            tone: 'success',
          }),
        onError: () => showToast(common('adminMenu.failed'), { tone: 'error' }),
      },
    );
  };

  let content;
  if (menu) {
    const counts = menuCounts(menu.dishes);
    const sections = menuSections(menu, { status, category: station, query });
    // The dialog follows the dish as it changes.
    const openDish = open ? menu.getDish(open.dish.slug) : undefined;
    const tiles: StatTile[] = [
      { id: 'all', label: t('stock.summary.all'), value: String(counts.all), icon: 'menu' },
      {
        id: 'available',
        label: t('stock.summary.available'),
        value: String(counts.available),
        icon: 'checkc',
      },
      {
        id: 'soldOut',
        label: t('stock.summary.soldOut'),
        value: String(counts.soldOut),
        icon: 'alert',
        tone: counts.soldOut > 0 ? 'alert' : undefined,
      },
      {
        id: 'offToday',
        label: t('stock.summary.offToday'),
        value: String(counts.offToday),
        icon: 'clock',
      },
    ];

    content = (
      <>
        <p className={styles.intro}>{t('stock.intro')}</p>
        <StatTiles tiles={tiles} label={t('stock.summary.label')} />

        <section className={styles.panel} aria-label={t('stock.title')}>
          <div className={styles.tools}>
            <SearchField
              value={query}
              onChange={setQuery}
              label={t('stock.search')}
              placeholder={t('stock.search')}
            />
            <div className={styles.chips} role="group" aria-label={t('stock.status')}>
              {MENU_STATUS_FILTERS.map((f) => (
                <Chip key={f} pressed={status === f} count={counts[f]} onClick={() => setStatus(f)}>
                  {common(`adminMenu.filters.${f}`)}
                </Chip>
              ))}
            </div>
            {!query.trim() && (
              <div className={styles.chips} role="group" aria-label={t('stock.stations')}>
                <Chip pressed={station === 'all'} onClick={() => setStation('all')}>
                  {t('stock.allStations')}
                </Chip>
                {menu.categories.map((c) => (
                  <Chip key={c.id} pressed={station === c.id} onClick={() => setStation(c.id)}>
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
                aria-label={section.name || t('stock.results')}
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
                      onAvailability={() => setOpen({ dish, offFirst: false })}
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
              <p className={styles.emptyTitle}>{t('stock.empty.title')}</p>
              <p className={styles.emptyBody}>
                {query.trim()
                  ? t('stock.empty.search', { query: query.trim() })
                  : t(`stock.empty.${status}`)}
              </p>
            </div>
          )}
        </section>

        {openDish && (
          <AvailabilityDialog
            dish={openDish}
            initial={open?.offFirst ? 'soldOut' : undefined}
            onClose={() => setOpen(null)}
          />
        )}
      </>
    );
  } else if (error) {
    content = (
      <EmptyState icon="wifioff" tone="err" title={t('stock.failed')} className={styles.state}>
        {t('error.body')}
      </EmptyState>
    );
  } else {
    content = <div className={styles.skeleton} role="status" aria-label={t('stock.loading')} />;
  }

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">{t('stock.title')}</h1>
      {content}
    </div>
  );
}
