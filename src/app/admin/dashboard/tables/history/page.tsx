import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { TableHistory } from '@/components/admin/tables/TableHistory';

export const generateMetadata = () => adminMetadata('tableHistory');

/** One table's order history for every table (?table=5): it reads the number from the address. */
export default function AdminTableHistoryPage() {
  return <TableHistory />;
}
