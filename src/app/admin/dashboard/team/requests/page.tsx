import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { RotaRequests } from '@/components/admin/team/RotaRequests';

export const generateMetadata = () => adminMetadata('teamRequests');

export default function AdminTeamRequestsPage() {
  return <RotaRequests />;
}
