import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { ModulesSettings } from '@/components/admin/settings/ModulesSettings';

export const generateMetadata = () => adminMetadata('modules');

export default function AdminModulesSettingsPage() {
  return <ModulesSettings />;
}
