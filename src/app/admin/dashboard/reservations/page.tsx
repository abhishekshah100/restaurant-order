import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { ReservationsBoard } from '@/components/admin/reservations/ReservationsBoard';

export const generateMetadata = () => adminMetadata('reservations');

export default function AdminReservationsPage() {
  return <ReservationsBoard />;
}
