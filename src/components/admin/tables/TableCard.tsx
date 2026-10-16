import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { tablePath } from '@/lib/adminNav';
import { legendOf } from '@/lib/adminTables';
import { cx } from '@/lib/cx';
import { lateBy } from '@/lib/reservations';
import type { AdminFloorTable } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useSeatedLabel } from './useSeatedLabel';
import styles from './TableCard.module.css';

/**
 * One table on the floor plan: its number large, its seats, and its state in words with a dot
 * in the state's tone. A reserved table says for whom, when and how many (or how late they
 * are); seated guests, who and for how long; a taken table, its orders, what's due and how long
 * it's been seated. A booking later today shows as "Booked 9:30 PM". Opens the table's page.
 */
export function TableCard({ table, now }: { table: AdminFloorTable; now: Date | null }) {
  const t = useContent('common');
  const { money, clock } = useAdminWorkspace();
  const seatedLabel = useSeatedLabel();
  const status = t(`adminTables.status.${table.status}`);
  const seats = t.plural('adminTables.seats', table.seats);
  const seated = seatedLabel(table.seatedAt, now);
  const { booking } = table;
  const guests = booking && t.plural('adminReservations.guests', booking.partySize);
  const late = booking && now ? lateBy(booking, now.getTime()) : 0;

  return (
    <Link
      href={tablePath(table.table)}
      className={cx(styles.card, styles[legendOf(table.status)])}
      aria-label={t('adminTables.tile', { table: table.table, seats, status })}
    >
      <span className={styles.top} aria-hidden="true">
        <span className={styles.number}>{table.table}</span>
        <span className={styles.seats}>
          <Icon name="user" size="xs" />
          {table.seats}
        </span>
      </span>
      <span className={styles.status} aria-hidden="true">
        <span className={styles.dot} />
        {status}
      </span>
      <span className={styles.info} aria-hidden="true">
        {table.status === 'reserved' && booking ? (
          <>
            <span className={cx(styles.line, styles.booking)}>
              {t('adminTables.booking', { time: clock.time(booking.at), name: booking.guestName })}
            </span>
            <span className={cx(styles.line, late > 0 && styles.late)}>
              {late > 0 ? t('adminTables.late', { count: late }) : guests}
            </span>
          </>
        ) : table.status === 'seated' && booking ? (
          <>
            <span className={styles.line}>{[booking.guestName, guests].join(' · ')}</span>
            {seated && (
              <span className={styles.line}>
                <Icon name="clock" size="xs" />
                {seated}
              </span>
            )}
          </>
        ) : table.status === 'outOfService' ? (
          <span>{t('adminTables.outOfService')}</span>
        ) : table.status === 'available' ? (
          booking ? (
            <span className={cx(styles.line, styles.booking)}>
              <Icon name="calendar" size="xs" />
              {t('adminTables.nextBooking', { time: clock.time(booking.at) })}
            </span>
          ) : (
            <span>{t('adminTables.ready')}</span>
          )
        ) : (
          <>
            <span className={styles.line}>
              {[
                t.plural('adminTables.orders', table.orderCount),
                table.due > 0
                  ? t('adminTables.due', { amount: money.format(table.due) })
                  : t('adminTables.paidUp'),
              ].join(' · ')}
            </span>
            {seated && (
              <span className={styles.line}>
                <Icon name="clock" size="xs" />
                {seated}
              </span>
            )}
            {booking && (
              <span className={cx(styles.line, styles.booking)}>
                <Icon name="calendar" size="xs" />
                {t('adminTables.nextBooking', { time: clock.time(booking.at) })}
              </span>
            )}
          </>
        )}
      </span>
    </Link>
  );
}
