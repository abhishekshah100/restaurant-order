'use client';

import dynamic from 'next/dynamic';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useContent, useReservations } from '@/api/hooks';
import { Button, Chip, EmptyState, Icon, SearchField } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { ADMIN_LINKS, reservationsPath } from '@/lib/adminNav';
import {
  RESERVATION_FILTERS,
  bookingDays,
  bookingRange,
  dayOffset,
  filterReservations,
  guestCount,
  holdsTable,
  MAX_DAYS_AHEAD,
  onDay,
  reservationCounts,
  type ReservationFilter,
} from '@/lib/reservations';
import type { Reservation } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { DayStrip } from './DayStrip';
import type { EditorTarget } from './ReservationEditor';
import { ReservationRow } from './ReservationRow';
import { useReservationStatus } from './useReservationStatus';
import styles from './ReservationsBoard.module.css';

// Popups: each downloaded the first time it opens.
const ReservationDialog = dynamic(
  () => import('./ReservationDialog').then((m) => m.ReservationDialog),
  {
    ssr: false,
    loading: () => <LoadingSignal />,
  },
);
const ReservationEditor = dynamic(
  () => import('./ReservationEditor').then((m) => m.ReservationEditor),
  {
    ssr: false,
    loading: () => <LoadingSignal />,
  },
);

/** Late / arriving states move on this often. */
const STATE_REFRESH_MS = 30_000;

/**
 * /admin/dashboard/reservations/: the branch's bookings a day at a time. Pick today, tomorrow
 * or a day up to 60 days ahead (in the address, ?day=), see it counted (bookings, guests, seated, the next
 * arrival), filter (upcoming, seated, cancelled and no-show, all) and search; a row per booking
 * by time with Seat when the guests can sit. A row opens the booking; New reservation books a
 * table; History opens the past days (reservations/history/). Read from GET /admin/branches/:branchId/reservations, polled every 15 s.
 */
export function ReservationsBoard() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock } = useAdminWorkspace();
  const reservations = useReservations(branch.id);
  const tick = useNow(STATE_REFRESH_MS);
  const dayParam = useQueryParam('day');
  const [filter, setFilter] = useState<ReservationFilter>('upcoming');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const status = useReservationStatus();

  let content;
  if (reservations.data) {
    // Before the first tick, the server's time.
    const nowDate = tick ?? new Date(reservations.data.generatedAt);
    const now = nowDate.getTime();
    const all = reservations.data.reservations;
    const days = bookingDays(clock, nowDate);
    const range = bookingRange(clock, nowDate);
    const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : days[0].key;
    if (!days.some((d) => d.key === day)) {
      days.push({ key: day, offset: dayOffset(clock, nowDate, day) });
    }
    // Every day the calendar offers, and the one in the address.
    const counts = Object.fromEntries(
      [...bookingDays(clock, nowDate, MAX_DAYS_AHEAD + 1), ...days].map((d) => [
        d.key,
        onDay(all, clock, d.key).filter(holdsTable).length,
      ]),
    );
    const ofDay = onDay(all, clock, day);
    const filterCounts = reservationCounts(ofDay);
    const shown = filterReservations(ofDay, filter, query);
    const next = filterReservations(ofDay, 'upcoming', '')[0];
    const open = all.find((r) => r.id === openId);

    content = (
      <>
        <div className={styles.top}>
          <DayStrip
            days={days}
            value={day}
            range={range}
            counts={counts}
            label={t('adminReservations.days.label')}
            onChange={(key) =>
              router.replace(reservationsPath(key === days[0].key ? undefined : key), {
                scroll: false,
              })
            }
          />
          <div className={styles.actions}>
            <Button variant="secondary" iconStart="history" href={ADMIN_LINKS.reservationHistory}>
              {t('adminReservations.history.open')}
            </Button>
            <Button
              iconStart="plus"
              className={styles.new}
              onClick={() => setEditor({ kind: 'new' })}
            >
              {t('adminReservations.new')}
            </Button>
          </div>
        </div>

        <dl className={styles.stats} aria-label={t('adminReservations.stats.label')}>
          <div className={styles.stat}>
            <dt>{t('adminReservations.stats.bookings')}</dt>
            <dd>{counts[day] ?? 0}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('adminReservations.stats.guests')}</dt>
            <dd>{guestCount(ofDay)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>{t('adminReservations.stats.seated')}</dt>
            <dd>{filterCounts.seated}</dd>
          </div>
          <div className={`${styles.stat} ${styles.next}`}>
            <dt>{t('adminReservations.stats.next')}</dt>
            <dd>
              {next
                ? [clock.dateTime(next.at), next.guestName].join(' · ')
                : t('adminReservations.stats.none')}
            </dd>
          </div>
        </dl>

        <section className={styles.panel} aria-label={t('adminReservations.title')}>
          <div className={styles.tools}>
            <SearchField
              id="reservation-search"
              value={query}
              onChange={setQuery}
              label={t('adminReservations.search')}
              placeholder={t('adminReservations.search')}
            />
            <div
              className={styles.filters}
              role="group"
              aria-label={t('adminReservations.filters.label')}
            >
              {RESERVATION_FILTERS.map((f) => (
                <Chip
                  key={f}
                  pressed={filter === f}
                  count={filterCounts[f]}
                  onClick={() => setFilter(f)}
                >
                  {t(`adminReservations.filters.${f}`)}
                </Chip>
              ))}
            </div>
          </div>

          {shown.length > 0 ? (
            <ul className={styles.list}>
              {shown.map((r: Reservation) => (
                <ReservationRow
                  key={r.id}
                  reservation={r}
                  now={now}
                  seating={status.busy(r, 'seated')}
                  onOpen={() => setOpenId(r.id)}
                  onSeat={() => status.set(r, 'seated')}
                />
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <Icon name="calendar" size="md" />
              </span>
              <p className={styles.emptyTitle}>{t('adminReservations.empty.title')}</p>
              <p className={styles.emptyBody}>
                {ofDay.length > 0
                  ? t('adminReservations.empty.filtered')
                  : t('adminReservations.empty.body')}
              </p>
            </div>
          )}
        </section>

        {open && (
          <ReservationDialog
            reservation={open}
            now={now}
            onClose={() => setOpenId(null)}
            onEdit={(r) => {
              setOpenId(null);
              setEditor({ kind: 'edit', reservation: r });
            }}
          />
        )}
      </>
    );
  } else if (reservations.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminReservations.error.title')}
        className={styles.state}
        actions={
          <Button
            iconStart="refresh"
            loading={reservations.isFetching}
            onClick={() => reservations.refetch()}
          >
            {t('adminReservations.error.retry')}
          </Button>
        }
      >
        {t('adminReservations.error.body')}
      </EmptyState>
    );
  } else {
    content = (
      <div className={styles.skeleton} role="status" aria-label={t('adminReservations.loading')} />
    );
  }

  return (
    <div className={styles.page}>
      {/* The bar above already names the page; the heading is for screen readers. */}
      <h1 className="visually-hidden">{t('adminReservations.title')}</h1>
      {content}
      {editor && <ReservationEditor target={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}
