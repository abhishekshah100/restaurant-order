import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { DeliveryZonesEditor } from '@/components/admin/settings/delivery/DeliveryZonesEditor';

export const generateMetadata = () => adminMetadata('deliveryZones');

export default function AdminDeliveryZonesPage() {
  return <DeliveryZonesEditor />;
}
