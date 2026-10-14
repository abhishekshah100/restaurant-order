import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { RequestsSection } from '@/components/admin/sections/RequestsSection';

export const generateMetadata = () => adminMetadata('requests');

export default function AdminRequestsPage() {
  return <RequestsSection />;
}
