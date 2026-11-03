import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { RolesManager } from '@/components/admin/settings/roles/RolesManager';

export const generateMetadata = () => adminMetadata('roles');

export default function AdminRolesPage() {
  return <RolesManager />;
}
