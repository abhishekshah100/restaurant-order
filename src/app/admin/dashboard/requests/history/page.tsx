import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { RequestHistory } from '@/components/admin/requests/RequestHistory';

export const generateMetadata = () => adminMetadata('requestHistory');

export default function AdminRequestHistoryPage() {
  return <RequestHistory />;
}
