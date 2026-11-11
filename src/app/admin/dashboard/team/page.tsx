import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { RotaPlanner } from '@/components/admin/team/RotaPlanner';

export const generateMetadata = () => adminMetadata('rota');

export default function AdminRotaPage() {
  return <RotaPlanner />;
}
