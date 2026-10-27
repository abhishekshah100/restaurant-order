'use client';

import dynamic from 'next/dynamic';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Dialog, EmptyState, Icon, SearchField, Select } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { MODE_FILTERS, type ModeFilter } from '@/lib/adminOrders';
import { cx } from '@/lib/cx';
import {
  KITCHEN_LANES,
  allDay,
  boardStats,
  boardTickets,
  laneTickets,
  modeCounts,
  nextKitchenStep,
  type KitchenLane,
  type KitchenTicket,
  type StationFilter,
} from '@/lib/kitchenBoard';
import type { Dish } from '@/types/menu';
import { playChime } from '../shell/kitchenSound';
import { TEXT_SCALE, useKitchenPrefs } from '../shell/useKitchenPrefs';
import { useKitchenThemeClass } from '../shell/useKitchenTheme';
import { useSoundUnlock } from '../shell/useSoundUnlock';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { useKitchenTickets } from '../useKitchenTickets';
import { useTicketWhere } from '../useTicketWhere';
import { AllDayList } from './AllDayList';
import { BoardStats } from './BoardStats';
import { TicketCard } from './TicketCard';
import { useKotPrint } from './KotPrint';
import { useArrivals, useTicketActions } from './useTicketActions';
import { useBoardKeyboard } from './useBoardKeyboard';
import { useConnection } from './useConnection';
import { useWaitingReminder } from './useWaitingReminder';
import styles from './KitchenBoard.module.css';

// Popups: each downloaded the first time it opens.
const KitchenMessageDialog = dynamic(
  () => import('./KitchenMessageDialog').then((m) => m.KitchenMessageDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);
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
 * /admin/kitchen-dashboard/: the kitchen display, dark like a kitchen screen. Every round guests
 * and waiters send is a ticket, oldest first, in three lanes — New, Cooking, Ready — under one
 * row of tools: order type, station (a menu category), search, the kitchen's numbers (late in
 * red, dishes to cook, the average ticket) and All day (a side panel). From 1024px the lanes
 * sit side by side, each scrolling on its own, a busy lane wider and an empty one a strip. Below
 * 1024px one lane at a time, picked from tabs. Start cooking and Mark ready move a ticket on at
 * once; guests' tracking and the waiters' Ready to serve follow. New tickets chime (and print,
 * if this screen prints them), and a ticket left in New reminds; a ticket opens large from its
 * place; a keyboard or bump bar picks and moves tickets; the screen's text size, station and
 * the rest are its own (Screen settings). How current it is shows beside the tools. Read from
 * GET /admin/branches/:branchId/orders, polled every 15 s.
 */
export function KitchenBoard() {
  const t = useContent('kitchen');
  const common = useContent('common');
  const kitchen = useKitchenTickets();
  const { tickets, categories, categoryOf, dishOf } = kitchen;
  const now = useNow(BOARD_REFRESH_MS);
  const actions = useTicketActions();
  const { clock } = useAdminWorkspace();
  const [prefs, updatePrefs] = useKitchenPrefs();
  const themeClass = useKitchenThemeClass();
  const whereOf = useTicketWhere();
  const kot = useKotPrint(dishOf);
  const printKot = kot.print;
  const soundBlocked = useSoundUnlock(prefs.sound);
  const connection = useConnection(kitchen.updatedAt, kitchen.failing, now);
  const [mode, setMode] = useState<ModeFilter>('all');
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  // The ticket whose order the kitchen is messaging the waiters about.
  const [messageKey, setMessageKey] = useState<string | null>(null);
  // This screen's station is kept on the device (a station's own tablet), and can come in the
  // address: /admin/kitchen-dashboard/?station=tandoor.
  // Taken once: picking another station afterwards keeps it.
  const stationParam = useQueryParam('station');
  const stationTaken = useRef(false);
  useEffect(() => {
    if (!stationParam || stationTaken.current) return;
    stationTaken.current = true;
    updatePrefs({ station: stationParam });
  }, [stationParam, updatePrefs]);
  // A station gone from the menu since shows everything.
  const station: StationFilter = categories.find((c) => c.id === prefs.station)?.id ?? 'all';
  const setStation = (next: StationFilter) => updatePrefs({ station: next });
  const [lane, setLane] = useState<KitchenLane>('new');
  const [allDayOpen, setAllDayOpen] = useState(false);
  // The dish a cook is taking off the menu from a ticket (the Menu page's own dialog).
  const [outOfStock, setOutOfStock] = useState<Dish | null>(null);
  // New tickets: a chime, and a printed ticket where this screen prints them.
  const onArrive = useCallback(
    (arrived: KitchenTicket[]) => {
      if (prefs.sound) playChime('arrival');
      if (prefs.autoPrint) printKot(arrived);
    },
    [prefs.sound, prefs.autoPrint, printKot],
  );
  // A ticket changed or cancelled: the arrival chime, as it may be on the stove already.
  const onAlert = useCallback(() => {
    if (prefs.sound) playChime('arrival');
  }, [prefs.sound]);
  useArrivals(tickets, actions.setAnnouncement, onArrive, onAlert);
  // Cancelled tickets the kitchen has seen and put away (they go by themselves after a while).
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const dismiss = useCallback((key: string) => setDismissed((keys) => new Set(keys).add(key)), []);
  useWaitingReminder(tickets, prefs.sound && prefs.reminders);

  const view = useMemo(() => {
    if (!tickets) return null;
    const filters = { mode, station, query };
    const shown = boardTickets(tickets, filters, categoryOf, now ?? undefined).filter(
      (ticket) => !dismissed.has(ticket.key),
    );
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
  }, [categories, categoryOf, dismissed, mode, now, query, station, tickets]);
  const stats = useMemo(() => (tickets && now ? boardStats(tickets, now) : null), [now, tickets]);

  // The keyboard picks tickets in the order they're shown: New, then Cooking, then Ready.
  const shownInOrder = useMemo(
    () => (view ? KITCHEN_LANES.flatMap((l) => view.lanes[l]) : []),
    [view],
  );
  const { step } = actions;
  const picked = useBoardKeyboard(shownInOrder, {
    onNext: (ticket) => {
      const next = nextKitchenStep(ticket.stage);
      if (next) step(ticket, next);
    },
    onOpen: (ticket) => setOpenKey(ticket.key),
    onPrint: (ticket) => printKot([ticket]),
    onUndo: actions.undoLast,
  });
  const openTicket = openKey ? tickets?.find((ticket) => ticket.key === openKey) : undefined;
  const messageTicket = messageKey
    ? tickets?.find((ticket) => ticket.key === messageKey)
    : undefined;
  const cardProps = (ticket: KitchenTicket) => ({
    ticket,
    now,
    station,
    categoryOf,
    dishOf,
    onOutOfStock: setOutOfStock,
    onTogglePlated: actions.togglePlated,
    onDismiss: dismiss,
    onMessage: setMessageKey,
    onStep: actions.step,
    pending: actions.pending.has(ticket.key),
  });

  let content;
  if (tickets && view) {
    const filtered = mode !== 'all' || station !== 'all' || query.trim() !== '';
    const allDayCount = view.allDay.reduce((n, g) => n + g.quantity, 0);
    content = (
      <>
        <div className={styles.toolbar}>
          <div className={styles.modes} role="group" aria-label={t('board.filters.modes')}>
            {MODE_FILTERS.map((m) => (
              <button
                key={m}
                type="button"
                className={styles.mode}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {m === 'all' ? t('board.filters.allModes') : common(`modes.${m}`)}
                <span className={styles.modeCount}>{view.byMode[m]}</span>
              </button>
            ))}
          </div>
          <Select
            id="kitchen-station"
            label={t('board.filters.stations')}
            hideLabel
            icon="flame"
            className={styles.station}
            value={station}
            onChange={(event) => setStation(event.target.value as StationFilter)}
          >
            <option value="all">{t('board.filters.allStations')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.shortName ?? category.name}
              </option>
            ))}
          </Select>
          <SearchField
            value={query}
            onChange={setQuery}
            label={t('board.filters.search')}
            placeholder={t('board.filters.search')}
            className={styles.search}
          />
          {stats && (
            <BoardStats stats={stats}>
              <div
                className={cx(styles.stat, styles.connection)}
                data-state={connection}
                title={
                  kitchen.updatedAt > 0
                    ? t('connection.updated', { time: clock.time(new Date(kitchen.updatedAt)) })
                    : undefined
                }
              >
                <dt className="visually-hidden">{t('connection.label')}</dt>
                <dd>
                  <span className={styles.connectionDot} aria-hidden="true" />
                  {connection === 'offline' ? t('connection.offline') : t('connection.live')}
                </dd>
              </div>
            </BoardStats>
          )}
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

        {connection !== 'live' && kitchen.updatedAt > 0 && (
          <p className={styles.banner} data-tone="warn" role="status">
            <Icon name="wifioff" size="sm" />
            {t(connection === 'offline' ? 'connection.offlineBanner' : 'connection.staleBanner', {
              time: clock.time(new Date(kitchen.updatedAt)),
            })}
          </p>
        )}
        {soundBlocked && (
          <p className={styles.banner} data-tone="info">
            <Icon name="bell" size="sm" />
            {t('soundBlocked')}
          </p>
        )}

        <div className={styles.board}>
          <div className={styles.laneSwitch} role="group" aria-label={t('board.lanes.label')}>
            {KITCHEN_LANES.map((l) => (
              <button
                key={l}
                type="button"
                className={styles.laneTab}
                data-lane={l}
                aria-pressed={lane === l}
                onClick={() => setLane(l)}
              >
                <Icon name={LANE_ICONS[l]} size="xs" />
                {t(`board.lanes.${l}`)}
                <span className={styles.laneTabCount}>{view.lanes[l].length}</span>
              </button>
            ))}
          </div>

          {/* A busy lane gets the room, an empty one shrinks to a strip (from 1024px). */}
          <div
            className={styles.lanes}
            style={{ '--lanes': laneColumns(view.lanes) } as CSSProperties}
          >
            {KITCHEN_LANES.map((l) => {
              const list = view.lanes[l];
              return (
                <section
                  key={l}
                  className={cx(styles.lane, lane === l && styles.current)}
                  data-lane={l}
                  data-empty={list.length === 0 || undefined}
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
                            {...cardProps(ticket)}
                            picked={picked === ticket.key}
                            onOpen={setOpenKey}
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
        </div>

        {/* Only rendered while open: the list is worked out with the board anyway. */}
        {allDayOpen && (
          <Dialog
            open
            className={themeClass}
            onClose={() => setAllDayOpen(false)}
            title={t('board.allDay.title')}
            description={t('board.allDay.subtitle')}
            presentation="panel"
          >
            <AllDayList groups={view.allDay} categories={categories} />
          </Dialog>
        )}

        {/* A ticket opened large: everything on it, its buttons, and Print. */}
        {openTicket && (
          <Dialog
            open
            onClose={() => setOpenKey(null)}
            title={t('expanded.title', { where: whereOf(openTicket), order: openTicket.orderId })}
            presentation="modal"
            className={cx(themeClass, styles.openDialog)}
            footer={
              <Button
                variant="secondary"
                iconStart="printer"
                onClick={() => printKot([openTicket])}
              >
                {t('ticket.print')}
              </Button>
            }
          >
            <TicketCard {...cardProps(openTicket)} large />
          </Dialog>
        )}
        {kot.sheet}
        {messageTicket && (
          <KitchenMessageDialog ticket={messageTicket} onClose={() => setMessageKey(null)} />
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
    <div
      className={styles.page}
      style={{ '--ticket-zoom': TEXT_SCALE[prefs.textSize] } as CSSProperties}
    >
      {/* The bar above names the page; the heading is for screen readers. */}
      <h1 className="visually-hidden">{t('board.title')}</h1>
      <p className="visually-hidden" role="status" aria-live="polite">
        {actions.announcement}
      </p>
      {content}
    </div>
  );
}

/** Lane widths: as many shares as tickets (up to three), a narrow strip when empty. */
function laneColumns(lanes: Record<KitchenLane, readonly unknown[]>): string {
  return KITCHEN_LANES.map((l) => {
    const n = lanes[l].length;
    return n === 0 ? 'minmax(210px, 0.6fr)' : `minmax(300px, ${Math.min(n, 3)}fr)`;
  }).join(' ');
}
