import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { ServicesEditor } from '@/components/admin/settings/services/ServicesEditor';

export const generateMetadata = () => adminMetadata('services');

export default function AdminServicesPage() {
  return <ServicesEditor />;
}
