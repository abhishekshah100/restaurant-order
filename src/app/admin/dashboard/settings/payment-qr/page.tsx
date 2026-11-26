import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { PaymentQrEditor } from '@/components/admin/settings/payments/PaymentQrEditor';

export const generateMetadata = () => adminMetadata('paymentQrs');

export default function AdminPaymentQrPage() {
  return <PaymentQrEditor />;
}
