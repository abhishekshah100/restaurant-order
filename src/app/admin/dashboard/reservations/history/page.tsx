import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { ReservationHistory } from '@/components/admin/reservations/ReservationHistory';

export const generateMetadata = () => adminMetadata('reservationHistory');

export default function AdminReservationHistoryPage() {
  return <ReservationHistory />;
}
