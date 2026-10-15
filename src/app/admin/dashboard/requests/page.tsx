import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { RequestsBoard } from '@/components/admin/requests/RequestsBoard';

export const generateMetadata = () => adminMetadata('requests');

export default function AdminRequestsPage() {
  return <RequestsBoard />;
}
