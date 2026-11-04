'use client';

import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { remindersDue } from '@/lib/reservations';
import type { Reservation } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { RemindActions } from './RemindActions';
import { useReservationText } from './useReservationText';
import styles from './ReservationExtras.module.css';

/**
 * Reminders: the parties booked in the next 24 hours with a number, soonest first. Each can be
 * reminded on WhatsApp or by SMS in a tap; those already reminded say so.
 */
export function RemindersPanel({
  reservations,
  now,
}: {
  reservations: readonly Reservation[];
  now: number;
}) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const text = useReservationText();
  const due = remindersDue(reservations, now);
  if (due.length === 0) return null;
  return (
    <section className={styles.panel} aria-labelledby="reminders-title">
      <div className={styles.panelHead}>
        <h2 id="reminders-title" className={styles.panelTitle}>
          {t('adminReservations.remind.title')}
        </h2>
        <span className={styles.muted}>{t('adminReservations.remind.body')}</span>
      </div>
      <ul className={styles.rows}>
        {due.map((r) => (
          <li key={r.id} className={styles.row}>
            <span className={styles.rowMain}>
              <strong>
                {[clock.dateTime(r.at), r.guestName, text.guests(r.partySize)].join(' · ')}
              </strong>
              {r.reminded && (
                <span className={styles.done}>
                  <Icon name="check" size="xs" />
                  {r.reminded.by
                    ? t('adminReservations.remind.reminded', {
                        name: r.reminded.by,
                        time: clock.time(r.reminded.at),
                      })
                    : t('adminReservations.remind.remindedNoName', {
                        time: clock.time(r.reminded.at),
                      })}
                </span>
              )}
            </span>
            <RemindActions reservation={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}
