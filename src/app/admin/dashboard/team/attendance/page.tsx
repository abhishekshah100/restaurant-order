import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { Attendance } from '@/components/admin/team/Attendance';

export const generateMetadata = () => adminMetadata('attendance');

export default function AdminAttendancePage() {
  return <Attendance />;
}
