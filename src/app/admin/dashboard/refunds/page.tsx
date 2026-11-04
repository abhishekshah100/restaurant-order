import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { RefundsPage } from '@/components/admin/refunds/RefundsPage';

export const generateMetadata = () => adminMetadata('refunds');

/** /admin/dashboard/refunds/: refunds and cancellations. */
export default function AdminRefundsPage() {
  return <RefundsPage />;
}
