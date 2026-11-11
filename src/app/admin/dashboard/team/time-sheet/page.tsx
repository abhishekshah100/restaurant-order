import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { MovedTo } from '@/components/admin/team/MovedTo';
import { ADMIN_LINKS } from '@/lib/adminNav';

export const generateMetadata = () => adminMetadata('attendance');

/** Team › Time sheet is Team › Attendance now: old links land there. */
export default function AdminTimeSheetPage() {
  return <MovedTo href={ADMIN_LINKS.attendance} />;
}
