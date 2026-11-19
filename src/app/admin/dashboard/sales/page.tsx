import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { SalesReportPage } from '@/components/admin/sales/SalesReportPage';

export const generateMetadata = () => adminMetadata('sales');

export default function AdminSalesPage() {
  return <SalesReportPage />;
}
