import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { PaymentHistory } from '@/components/admin/payments/PaymentHistory';

export const generateMetadata = () => adminMetadata('paymentHistory');

export default function AdminPaymentHistoryPage() {
  return <PaymentHistory />;
}
