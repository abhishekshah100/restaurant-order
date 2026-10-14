import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { FloorPlan } from '@/components/admin/tables/FloorPlan';

export const generateMetadata = () => adminMetadata('tables');

export default function AdminTablesPage() {
  return <FloorPlan />;
}
