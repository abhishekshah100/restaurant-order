'use client';

import dynamic from 'next/dynamic';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useMemo, useState } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Chip, Dialog, EmptyState, Icon, SearchField } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { MODE_FILTERS, type ModeFilter } from '@/lib/adminOrders';
import { cx } from '@/lib/cx';
import {
  KITCHEN_LANES,
  allDay,
  boardStats,
  boardTickets,
  laneTickets,
  modeCounts,
  type KitchenLane,
  type StationFilter,
} from '@/lib/kitchenBoard';
import type { Dish } from '@/types/menu';
import { useKitchenTickets } from '../useKitchenTickets';
import { AllDayList } from './AllDayList';
import { BoardStats } from './BoardStats';
import { TicketCard } from './TicketCard';
import { useArrivals, useTicketActions } from './useTicketActions';
import styles from './KitchenBoard.module.css';

// Popups: each downloaded the first time it opens.
const AvailabilityDialog = dynamic(
  () => import('@/components/admin/menu/AvailabilityDialog').then((m) => m.AvailabilityDialog),
  {
    ssr: false,
    loading: () => <LoadingSignal />,
  },
);

/** Urgency and "due in" move on this often (each ticket's clock ticks on its own). */
const BOARD_REFRESH_MS = 15_000;

const LANE_ICONS = { new: 'bell', cooking: 'flame', ready: 'cloche' } as const;

/**
 * /admin/kitchen-dashboard/: the kitchen display. Every round guests and waiters send is a ticket,
 * oldest first, in three lanes — New, Cooking, Ready — with the kitchen's numbers above
 * (late tickets in red), filters by order type, station (a menu category) and search, and the
 * all-day counts beside them (in a panel below 1280px). Start cooking and Mark ready move a
 * ticket on at once; guests' tracking and the waiters' Ready to serve follow. Below 1024px
 * one lane shows at a time. Read from GET /admin/branches/:branchId/orders, polled every 15 s.
 */
export function KitchenBoard() {
  const t = useContent('kitchen');
  const common = useContent('common');
  const kitchen = useKitchenTickets();
  const { tickets, categories, categoryOf, dishOf } = kitchen;
  const now = useNow(BOARD_REFRESH_MS);
  const actions = useTicketActions();
  const [mode, setMode] = useState<ModeFilter>('all');
  const [station, setStation] = useState<StationFilter>('all');
  const [query, setQuery] = useState('');
  const [lane, setLane] = useState<KitchenLane>('new');
  const [allDayOpen, setAllDayOpen] = useState(false);
  // The dish a cook is taking off the menu from a ticket (the Menu page's own dialog).
  const [outOfStock, setOutOfStock] = useState<Dish | null>(null);
  useArrivals(tickets, actions.setAnnouncement);

  const view = useMemo(() => {
    if (!tickets) return null;
    const filters = { mode, station, query };
    const shown = boardTickets(tickets, filters, categoryOf);
    return {
      shown,
      lanes: laneTickets(shown),
      byMode: modeCounts(tickets, { station, query }, categoryOf, MODE_FILTERS),
      // The counts follow the type and station chosen, not the search.
      allDay: allDay(
        boardTickets(tickets, { mode, station, query: '' }, categoryOf),
        categoryOf,
        categories.map((c) => c.id),
      ),
    };
  }, [categories, categoryOf, mode, query, station, tickets]);
  const stats = useMemo(() => (tickets && now ? boardStats(tickets, now) : null), [now, tickets]);

  let content;
  if (tickets && view) {
    const filtered = mode !== 'all' || station !== 'all' || query.trim() !== '';
    const allDayCount = view.allDay.reduce((n, g) => n + g.quantity, 0);
    content = (
      <>
        {stats && <BoardStats stats={stats} />}

        <div className={styles.tools}>
          <SearchField
            value={query}
            onChange={setQuery}
            label={t('board.filters.search')}
            placeholder={t('board.filters.search')}
            className={styles.search}
          />
          <div className={styles.chips} role="group" aria-label={t('board.filters.modes')}>
            {MODE_FILTERS.map((m) => (
              <Chip key={m} pressed={mode === m} count={view.byMode[m]} onClick={() => setMode(m)}>
                {m === 'all' ? t('board.filters.allModes') : common(`modes.${m}`)}
              </Chip>
            ))}
          </div>
          <div
            className={cx(styles.chips, styles.stations)}
            role="group"
            aria-label={t('board.filters.stations')}
          >
            <Chip pressed={station === 'all'} onClick={() => setStation('all')}>
              {t('board.filters.allStations')}
            </Chip>
            {categories.map((category) => (
              <Chip
                key={category.id}
                pressed={station === category.id}
                onClick={() => setStation(category.id)}
              >
                {category.shortName ?? category.name}
              </Chip>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            iconStart="list"
            className={styles.allDayButton}
            onClick={() => setAllDayOpen(true)}
            meta={allDayCount}
            aria-haspopup="dialog"
          >
            {t('board.allDay.open')}
          </Button>
        </div>

        <div className={styles.board}>
          <div className={styles.laneSwitch} role="group" aria-label={t('board.lanes.label')}>
            {KITCHEN_LANES.map((l) => (
              <Chip
                key={l}
                pressed={lane === l}
                count={view.lanes[l].length}
                iconStart={LANE_ICONS[l]}
                onClick={() => setLane(l)}
              >
                {t(`board.lanes.${l}`)}
              </Chip>
            ))}
          </div>

          <div className={styles.lanes}>
            {KITCHEN_LANES.map((l) => {
              const list = view.lanes[l];
              return (
                <section
                  key={l}
                  className={cx(styles.lane, lane === l && styles.current)}
                  data-lane={l}
                  aria-labelledby={`kitchen-lane-${l}`}
                >
                  <header className={styles.laneHead}>
                    <span className={styles.laneIcon} aria-hidden="true">
                      <Icon name={LANE_ICONS[l]} size="sm" />
                    </span>
                    <span className={styles.laneTitle}>
                      <h2 id={`kitchen-lane-${l}`}>{t(`board.lanes.${l}`)}</h2>
                      <span className={styles.laneHint}>{t(`board.lanes.hint.${l}`)}</span>
                    </span>
                    <span className={styles.laneCount}>{list.length}</span>
                  </header>
                  {list.length > 0 ? (
                    <ul className={styles.tickets}>
                      {list.map((ticket) => (
                        <li key={ticket.key}>
                          <TicketCard
                            ticket={ticket}
                            now={now}
                            station={station}
                            categoryOf={categoryOf}
                            dishOf={dishOf}
                            onOutOfStock={setOutOfStock}
                            plated={actions.plated.get(ticket.key) ?? NO_ITEMS}
                            onTogglePlated={actions.togglePlated}
                            onStep={actions.step}
                            pending={actions.pending.has(ticket.key)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.laneEmpty}>
                      {filtered ? t('board.lanes.noMatch') : t(`board.lanes.empty.${l}`)}
                    </p>
                  )}
                </section>
              );
            })}
          </div>

          <aside className={styles.allDay} aria-labelledby="kitchen-all-day">
            <h2 id="kitchen-all-day" className={styles.allDayTitle}>
              {t('board.allDay.title')}
            </h2>
            <p className={styles.allDaySub}>{t('board.allDay.subtitle')}</p>
            <AllDayList groups={view.allDay} categories={categories} />
          </aside>
        </div>

        {/* Its list is already on the page (the side column), so nothing to download: it's
            only rendered while open. */}
        {allDayOpen && (
          <Dialog
            open
            onClose={() => setAllDayOpen(false)}
            title={t('board.allDay.title')}
            description={t('board.allDay.subtitle')}
            presentation="panel"
          >
            <AllDayList groups={view.allDay} categories={categories} />
          </Dialog>
        )}

        {outOfStock && (
          <AvailabilityDialog
            dish={outOfStock}
            initial="soldOut"
            onClose={() => setOutOfStock(null)}
          />
        )}
      </>
    );
  } else if (kitchen.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('error.title')}
        className={styles.state}
        actions={
          <Button
            iconStart="refresh"
            loading={kitchen.isFetching}
            onClick={() => kitchen.refetch()}
          >
            {t('error.retry')}
          </Button>
        }
      >
        {t('error.body')}
      </EmptyState>
    );
  } else {
    content = <div className={styles.skeleton} role="status" aria-label={t('loading')} />;
  }

  return (
    <div className={styles.page}>
      {/* The bar above names the page; the heading is for screen readers. */}
      <h1 className="visually-hidden">{t('board.title')}</h1>
      <p className="visually-hidden" role="status" aria-live="polite">
        {actions.announcement}
      </p>
      {content}
    </div>
  );
}

/** A ticket with nothing plated (one object, so memoised cards don't re-render). */
const NO_ITEMS: ReadonlySet<number> = new Set();
