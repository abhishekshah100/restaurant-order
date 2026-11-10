import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { ShiftsReport } from '@/components/admin/settings/shifts/ShiftsReport';

export const generateMetadata = () => adminMetadata('shifts');

export default function AdminShiftsPage() {
  return <ShiftsReport />;
}
