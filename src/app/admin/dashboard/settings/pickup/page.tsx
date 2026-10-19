import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { PickupEditor } from '@/components/admin/settings/pickup/PickupEditor';

export const generateMetadata = () => adminMetadata('pickup');

export default function AdminPickupPage() {
  return <PickupEditor />;
}
