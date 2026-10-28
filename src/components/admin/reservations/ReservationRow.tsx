import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { canSeat, reservationState } from '@/lib/reservations';
import type { Reservation } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useReservationText } from './useReservationText';
import styles from './ReservationRow.module.css';

/**
 * One booking in a list: its time (and how long the table is held), the guest, party, table and
 * mobile, its note, its state toned (booked, arriving soon, late, seated, cancelled, no-show),
 * and Seat once the guests can be seated. The row opens the booking.
 */
export function ReservationRow({
  reservation: r,
  now,
  showTable = true,
  seating,
  onOpen,
  onSeat,
}: {
  reservation: Reservation;
  now: number;
  /** Off on a table's own page, where the table goes without saying. */
  showTable?: boolean;
  seating: boolean;
  onOpen: () => void;
  onSeat: () => void;
}) {
  const t = useContent('common');
  const { clock } = useAdminWorkspace();
  const text = useReservationText();
  const state = reservationState(r, now);
  const stateText = text.state(r, now);
  const time = clock.dateTime(r.at);
  const meta = [
    text.guests(r.partySize),
    ...(showTable ? [t('adminReservations.table', { table: r.table })] : []),
    ...(r.phone ? [text.phone(r.phone)] : []),
  ];

  return (
    <li className={styles.row} data-state={state}>
      <span className={styles.time} aria-hidden="true">
        <span className={styles.clock}>{time}</span>
        <span className={styles.length}>{text.length(r.minutes)}</span>
      </span>

      <div className={styles.main}>
        {/* Covers the row (see .open::after), so a tap anywhere opens the booking. */}
        <button
          type="button"
          className={styles.open}
          onClick={onOpen}
          aria-label={t('adminReservations.row.open', {
            id: r.id,
            name: r.guestName,
            time,
            state: stateText,
          })}
        >
          <span className={styles.name}>{r.guestName}</span>
          <span className={styles.id}>{r.id}</span>
        </button>
        <p className={styles.meta}>{meta.join(' · ')}</p>
        {r.note && (
          <p className={styles.note}>
            <Icon name="msg" size="xs" />
            <span>{r.note}</span>
          </p>
        )}
      </div>

      <span className={styles.state}>
        <span className={styles.dot} aria-hidden="true" />
        {stateText}
      </span>

      <div className={styles.end}>
        {canSeat(r, now) ? (
          <button
            type="button"
            className={styles.seat}
            disabled={seating}
            onClick={onSeat}
            aria-label={t('adminReservations.row.seatLabel', { name: r.guestName, table: r.table })}
          >
            <Icon name="check" size="xs" />
            {t('adminReservations.row.seat')}
          </button>
        ) : (
          <Icon name="chev" size="xs" className={styles.chev} />
        )}
      </div>
    </li>
  );
}
