import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { PaymentsBoard } from '@/components/admin/payments/PaymentsBoard';

export const generateMetadata = () => adminMetadata('payments');

export default function AdminPaymentsPage() {
  return <PaymentsBoard />;
}
