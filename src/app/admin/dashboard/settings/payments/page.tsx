import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { PaymentMethodsEditor } from '@/components/admin/settings/payments/PaymentMethodsEditor';

export const generateMetadata = () => adminMetadata('paymentMethods');

export default function AdminPaymentMethodsPage() {
  return <PaymentMethodsEditor />;
}
