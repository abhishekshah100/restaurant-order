'use client';

import Link from 'next/link';
import { useContent, useReservations } from '@/api/hooks';
import { Button, Icon } from '@/components/ui';
import { arrivingSoon } from '@/lib/adminHome';
import { ADMIN_LINKS } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { bookingTables, canSeat, lateBy } from '@/lib/reservations';
import { minutesSince } from '@/lib/adminService';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useReservationStatus } from '../reservations/useReservationStatus';
import styles from './HomePanels.module.css';

/**
 * Arriving soon: today's bookings in the next two hours (and those up to an hour late), soonest
 * first: time, who, how many, which table, the note (birthday, allergy), how soon or how late,
 * and Seat once they can sit. Hidden when there are none; only for those who handle bookings.
 */
export function ArrivingSoon({ now }: { now: Date | null }) {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const reservations = useReservations(branch.id);
  const status = useReservationStatus();
  if (!now || !reservations.data) return null;
  const soon = arrivingSoon(reservations.data.reservations, now);
  if (soon.length === 0) return null;

  return (
    <section className={styles.panel} aria-labelledby="arriving-title">
      <header className={styles.head}>
        <div>
          <h2 id="arriving-title" className={styles.title}>
            {t('adminHome.arriving.title')}
          </h2>
          <p className={styles.subtitle}>{t('adminHome.arriving.subtitle')}</p>
        </div>
        <Link href={ADMIN_LINKS.reservations} className={styles.all}>
          {t('adminHome.arriving.all')}
          <Icon name="chev" size="xs" />
        </Link>
      </header>
      <ul className={styles.list}>
        {soon.map((r) => {
          const late = lateBy(r, now.getTime());
          // Minutes until it's due (0 once it is).
          const inMinutes = minutesSince(now.toISOString(), new Date(r.at));
          const tables = bookingTables(r).join(' + ');
          return (
            <li key={r.id} className={styles.row}>
              <span className={styles.time}>{clock.time(r.at)}</span>
              <span className={styles.main}>
                <span className={styles.name}>{r.guestName}</span>
                <span className={styles.meta}>
                  {[
                    t.plural('adminHome.arriving.guests', r.partySize),
                    t('adminHome.arriving.table', { tables }),
                  ].join(' · ')}
                </span>
                {r.note && (
                  <span className={styles.note}>{t('adminHome.queue.note', { note: r.note })}</span>
                )}
                <span className={cx(styles.when, late > 0 && styles.late)}>
                  {late > 0
                    ? t('adminHome.arriving.late', { count: late })
                    : inMinutes > 0
                      ? t('adminHome.arriving.inMinutes', { count: inMinutes })
                      : t('adminHome.arriving.now')}
                </span>
              </span>
              {canSeat(r, now.getTime()) && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={status.busy(r, 'seated')}
                  aria-label={t('adminHome.arriving.seatLabel', { name: r.guestName, tables })}
                  onClick={() => status.set(r, 'seated')}
                >
                  {t('adminHome.arriving.seat')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
