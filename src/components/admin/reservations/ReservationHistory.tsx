'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useContent, useReservationHistory } from '@/api/hooks';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { Button, Chip, EmptyState, Icon, SearchField } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useQueryParam } from '@/hooks/useQueryParam';
import { ADMIN_LINKS, reservationHistoryPath } from '@/lib/adminNav';
import { downloadXlsx, toXlsx } from '@/lib/xlsx';
import { parseDayRange, shiftDay, type DayRange } from '@/lib/dayRange';
import {
  bookingTables,
  HISTORY_DAYS,
  HISTORY_FILTERS,
  byDay,
  filterHistory,
  historyCounts,
  historySummary,
  type HistoryFilter,
} from '@/lib/reservations';
import type { Reservation } from '@/types/admin';
import { DateRangeFilter } from '../DateRangeFilter';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import type { EditorTarget } from './ReservationEditor';
import { ReservationRow } from './ReservationRow';
import { useReservationStatus } from './useReservationStatus';
import { useReservationText } from './useReservationText';
import board from './ReservationsBoard.module.css';
import styles from './ReservationHistory.module.css';

// Popups: each downloaded the first time it opens.
const ReservationDialog = dynamic(
  () => import('./ReservationDialog').then((m) => m.ReservationDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);
const ReservationEditor = dynamic(
  () => import('./ReservationEditor').then((m) => m.ReservationEditor),
  { ssr: false, loading: () => <LoadingSignal /> },
);

/** States (late, not marked) move on this often. */
const STATE_REFRESH_MS = 30_000;

/**
 * /admin/dashboard/reservations/history/: the branch's bookings on past days, for looking back.
 * The days in the address (?from=&to=, up to a year back), the last 30 without; counted
 * (bookings, guests seated, how many showed up, no-shows, cancelled), filtered (all, came,
 * no-show, cancelled, not marked) and searched; the latest first under each day. A row opens
 * the booking, as on Reservations; Download Excel saves what's shown. Read from
 * GET /admin/branches/:branchId/reservations?from=&to=.
 */
export function ReservationHistory() {
  const t = useContent('common');
  const router = useRouter();
  const { branch, clock } = useAdminWorkspace();
  const text = useReservationText();
  const tick = useNow(STATE_REFRESH_MS);
  const today = clock.dayKey(tick ?? new Date());
  const from = useQueryParam('from');
  const to = useQueryParam('to');
  const days: DayRange =
    from || to
      ? parseDayRange(from, to, today)
      : { from: shiftDay(today, -(HISTORY_DAYS - 1)), to: today };
  const history = useReservationHistory(branch.id, days);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const status = useReservationStatus();
  const dayLabel = (key: string) => clock.date(`${key}T12:00:00Z`);

  let content;
  // Saves the bookings shown, once they're read.
  let exportShown: (() => void) | undefined;
  if (history.data) {
    const now = (tick ?? new Date(history.data.generatedAt)).getTime();
    const all = history.data.reservations;
    const counts = historyCounts(all, now);
    const summary = historySummary(all, now);
    const shown = filterHistory(all, filter, query, now);
    const open = all.find((r) => r.id === openId);

    exportShown = () => {
      const c = (key: Parameters<typeof t>[0]) => t(key);
      const workbook = toXlsx(
        t('adminReservations.history.title'),
        shown,
        [
          c('adminReservations.history.columns.date'),
          c('adminReservations.history.columns.time'),
          c('adminReservations.history.columns.booking'),
          c('adminReservations.history.columns.guest'),
          c('adminReservations.history.columns.mobile'),
          c('adminReservations.history.columns.party'),
          c('adminReservations.history.columns.table'),
          c('adminReservations.history.columns.held'),
          c('adminReservations.history.columns.status'),
          c('adminReservations.history.columns.takenBy'),
          c('adminReservations.history.columns.changedBy'),
          c('adminReservations.history.columns.note'),
        ],
        (r: Reservation) => [
          clock.date(r.at),
          clock.time(r.at),
          r.id,
          r.guestName,
          r.phone ? text.phone(r.phone) : '',
          r.partySize,
          bookingTables(r).join(' + '),
          text.length(r.minutes),
          text.state(r, now),
          r.createdBy,
          r.updatedBy ?? '',
          r.note ?? '',
        ],
      );
      downloadXlsx(
        workbook,
        t('adminReservations.history.exportFile', {
          branch: branch.id,
          dates: days.from === days.to ? days.from : `${days.from}_${days.to}`,
        }),
      );
    };

    if (shown.length === 0) exportShown = undefined;

    content = (
      <>
        <dl className={styles.stats} aria-label={t('adminReservations.history.stats.label')}>
          <div className={board.stat}>
            <dt>{t('adminReservations.history.stats.bookings')}</dt>
            <dd>{summary.bookings}</dd>
          </div>
          <div className={board.stat}>
            <dt>{t('adminReservations.history.stats.guests')}</dt>
            <dd>{summary.guests}</dd>
          </div>
          <div className={board.stat}>
            <dt>{t('adminReservations.history.stats.showRate')}</dt>
            <dd>
              {summary.showRate === null
                ? t('adminReservations.history.stats.none')
                : t('adminReservations.history.stats.showRateValue', {
                    percent: summary.showRate,
                  })}
            </dd>
          </div>
          <div className={board.stat}>
            <dt>{t('adminReservations.history.stats.noShows')}</dt>
            <dd>{summary.noShows}</dd>
          </div>
          <div className={board.stat}>
            <dt>{t('adminReservations.history.stats.cancelled')}</dt>
            <dd>{summary.cancelled}</dd>
          </div>
        </dl>

        <section className={board.panel} aria-label={t('adminReservations.history.title')}>
          <div className={board.tools}>
            <SearchField
              id="reservation-history-search"
              value={query}
              onChange={setQuery}
              label={t('adminReservations.history.search')}
              placeholder={t('adminReservations.history.search')}
            />
            <div
              className={board.filters}
              role="group"
              aria-label={t('adminReservations.history.filters.label')}
            >
              {HISTORY_FILTERS.map((f) => (
                <Chip key={f} pressed={filter === f} count={counts[f]} onClick={() => setFilter(f)}>
                  {t(`adminReservations.history.filters.${f}`)}
                </Chip>
              ))}
            </div>
          </div>

          {shown.length > 0 ? (
            byDay(shown, clock).map(({ day, reservations }) => (
              <section key={day} aria-labelledby={`history-${day}`}>
                <h2 id={`history-${day}`} className={styles.day}>
                  {t.plural('adminReservations.history.day', reservations.length, {
                    date: dayLabel(day),
                  })}
                </h2>
                <ul className={board.list}>
                  {reservations.map((r) => (
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
              </section>
            ))
          ) : (
            <div className={board.empty}>
              <span className={board.emptyIcon} aria-hidden="true">
                <Icon name="calendar" size="md" />
              </span>
              <p className={board.emptyTitle}>{t('adminReservations.history.empty.title')}</p>
              <p className={board.emptyBody}>
                {all.length > 0
                  ? t('adminReservations.history.empty.filtered')
                  : t('adminReservations.history.empty.body')}
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
  } else if (history.isError) {
    content = (
      <EmptyState
        icon="wifioff"
        tone="err"
        title={t('adminReservations.history.error.title')}
        className={board.state}
        actions={
          <Button
            iconStart="refresh"
            loading={history.isFetching}
            onClick={() => history.refetch()}
          >
            {t('adminReservations.history.error.retry')}
          </Button>
        }
      >
        {t('adminReservations.history.error.body')}
      </EmptyState>
    );
  } else {
    content = (
      <div
        className={board.skeleton}
        role="status"
        aria-label={t('adminReservations.history.loading')}
      />
    );
  }

  return (
    <div className={board.page}>
      <Link href={ADMIN_LINKS.reservations} className={styles.back}>
        <Icon name="back" size="xs" />
        {t('adminReservations.history.back')}
      </Link>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{t('adminReservations.history.title')}</h1>
          <p className={styles.subtitle}>{t('adminReservations.history.subtitle')}</p>
        </div>
        <Button
          variant="secondary"
          iconStart="list"
          disabled={!exportShown}
          onClick={() => exportShown?.()}
        >
          {t('adminReservations.history.export')}
        </Button>
      </header>
      <DateRangeFilter
        id="reservation-history-days"
        range={days}
        today={today}
        onChange={(range) => router.replace(reservationHistoryPath(range), { scroll: false })}
      />
      {content}
      {editor && <ReservationEditor target={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}
