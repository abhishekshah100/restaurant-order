import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { OffersManager } from '@/components/admin/settings/offers/OffersManager';

export const generateMetadata = () => adminMetadata('offers');

export default function AdminOffersPage() {
  return <OffersManager />;
}
