import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { Purchasing } from '@/components/admin/purchasing/Purchasing';

export const generateMetadata = () => adminMetadata('purchasing');

/** /admin/dashboard/purchasing/: suppliers, purchase orders, deliveries and returns. */
export default function AdminPurchasingPage() {
  return <Purchasing />;
}
