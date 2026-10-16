import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { SettingsHome } from '@/components/admin/settings/SettingsHome';

export const generateMetadata = () => adminMetadata('settings');

export default function AdminSettingsPage() {
  return <SettingsHome />;
}
