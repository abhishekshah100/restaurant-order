import { useContent } from '@/api/hooks';
import { useSetReservationStatus } from '@/api/mutations';
import { useToast } from '@/context/ToastContext';
import { bookingTables } from '@/lib/reservations';
import type { Reservation, ReservationStatus } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { useReservationText } from './useReservationText';

/**
 * Seat, cancel, mark a no-show or restore a booking, with a toast saying what happened (or why
 * it couldn't). `busy` says which booking and change is on its way.
 */
export function useReservationStatus() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const text = useReservationText();
  const mutation = useSetReservationStatus();

  const set = (r: Reservation, status: ReservationStatus, onDone?: () => void) =>
    mutation.mutate(
      { branchId: branch.id, id: r.id, body: { status } },
      {
        onSuccess: () => {
          showToast(
            t(`adminReservations.toast.${status}`, {
              id: r.id,
              name: r.guestName,
              tables: text.tables(bookingTables(r)),
            }),
            { tone: 'success' },
          );
          onDone?.();
        },
        onError: (error) => showToast(text.error(error, bookingTables(r)), { tone: 'error' }),
      },
    );

  const busy = (r: Reservation, status?: ReservationStatus) =>
    mutation.isPending &&
    mutation.variables?.id === r.id &&
    (status === undefined || mutation.variables.body.status === status);

  return { set, busy };
}
