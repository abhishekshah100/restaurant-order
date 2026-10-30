import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { formatMobile } from '@/lib/phone';
import { isUnmarked, lateBy, reservationState } from '@/lib/reservations';
import type { Reservation } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/** How bookings read on every staff page: their state, length, party, mobile and errors. */
export function useReservationText() {
  const t = useContent('common');
  const { clock, region } = useAdminWorkspace();

  return {
    /**
     * "Booked", "Arriving soon", "12 min late", "Seated", "Cancelled", "No-show"; "Not marked"
     * once the table's hold is over and nobody seated it or marked a no-show (the history).
     */
    state(r: Reservation, now: number) {
      const state = reservationState(r, now);
      if (state !== 'late') return t(`adminReservations.state.${state}`);
      return isUnmarked(r, now)
        ? t('adminReservations.state.unmarked')
        : t('adminReservations.state.late', { count: lateBy(r, now) });
    },
    /** "1 h 30 min". */
    length(minutes: number) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return rest
        ? t('adminReservations.length.hoursMinutes', { hours, minutes: rest })
        : t('adminReservations.length.hours', { hours });
    },
    guests: (count: number) => t.plural('adminReservations.guests', count),
    /** "+91 98765 01234". */
    phone: (digits: string) => `${region.mobile.dialCode} ${formatMobile(digits, region.mobile)}`,
    /** "Table 4", or "Tables 4 + 5" for a party on several. */
    tables(tables: readonly number[]) {
      return tables.length === 1
        ? t('adminReservations.table', { table: tables[0] })
        : t('adminReservations.tables', { tables: tables.join(' + ') });
    },
    /**
     * What went wrong saving a booking (at `tables`) or changing its status, in words; a table
     * taken names which one.
     */
    error(error: unknown, tables: readonly number[]) {
      if (isApiError(error, 'table_taken') && error.body?.reservation) {
        return t('adminReservations.toast.taken', {
          table: error.body.table ?? tables[0] ?? '',
          name: error.body.reservation.guestName,
          time: clock.dateTime(error.body.reservation.at),
        });
      }
      if (isApiError(error, 'reservation_closed')) return t('adminReservations.toast.closed');
      return t('adminReservations.toast.failed');
    },
  };
}
