import { MovedTo } from '@/components/admin/team/MovedTo';
import { ADMIN_LINKS } from '@/lib/adminNav';

/** Moved: Team › Attendance. */
export default function OldShiftsPage() {
  return <MovedTo href={ADMIN_LINKS.attendance} />;
}
