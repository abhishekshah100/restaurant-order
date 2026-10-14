import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { TablesSection } from '@/components/admin/sections/TablesSection';

export const generateMetadata = () => adminMetadata('tables');

export default function AdminTablesPage() {
  return <TablesSection />;
}
