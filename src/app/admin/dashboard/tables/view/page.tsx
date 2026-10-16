import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { TableDetail } from '@/components/admin/tables/TableDetail';

export const generateMetadata = () => adminMetadata('table');

/** One table's page for every table (?table=5): it reads the number from the address. */
export default function AdminTablePage() {
  return <TableDetail />;
}
