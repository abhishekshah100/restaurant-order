import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { InvoiceList } from '@/components/admin/payments/InvoiceList';

export const generateMetadata = () => adminMetadata('invoices');

export default function AdminInvoicesPage() {
  return <InvoiceList />;
}
