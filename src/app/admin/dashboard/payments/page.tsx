import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { PaymentsSection } from '@/components/admin/sections/PaymentsSection';

export const generateMetadata = () => adminMetadata('payments');

export default function AdminPaymentsPage() {
  return <PaymentsSection />;
}
