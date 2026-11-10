import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { HelpPageEditor } from '@/components/admin/settings/help/HelpPageEditor';

export const generateMetadata = () => adminMetadata('helpPage');

export default function AdminHelpPageSettings() {
  return <HelpPageEditor />;
}
