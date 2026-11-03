import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { StaffManager } from '@/components/admin/settings/staff/StaffManager';

export const generateMetadata = () => adminMetadata('staff');

export default function AdminStaffPage() {
  return <StaffManager />;
}
