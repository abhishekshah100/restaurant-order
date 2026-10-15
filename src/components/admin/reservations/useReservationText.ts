import { isApiError } from '@/api/client';
import { useContent } from '@/api/hooks';
import { formatMobile } from '@/lib/phone';
import { lateBy, reservationState } from '@/lib/reservations';
import type { Reservation } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/** How bookings read on every staff page: their state, length, party, mobile and errors. */
export function useReservationText() {
  const t = useContent('common');
  const { clock, region } = useAdminWorkspace();

  return {
    /** "Booked", "Arriving soon", "12 min late", "Seated", "Cancelled", "No-show". */
    state(r: Reservation, now: number) {
      const state = reservationState(r, now);
      return state === 'late'
        ? t('adminReservations.state.late', { count: lateBy(r, now) })
        : t(`adminReservations.state.${state}`);
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
    /** What went wrong saving a booking (at `table`) or changing its status, in words. */
    error(error: unknown, table: number) {
      if (isApiError(error, 'table_taken') && error.body?.reservation) {
        return t('adminReservations.toast.taken', {
          table,
          name: error.body.reservation.guestName,
          time: clock.time(error.body.reservation.at),
        });
      }
      if (isApiError(error, 'reservation_closed')) return t('adminReservations.toast.closed');
      return t('adminReservations.toast.failed');
    },
  };
}
