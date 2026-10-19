import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { BranchesManager } from '@/components/admin/settings/branches/BranchesManager';

export const generateMetadata = () => adminMetadata('branches');

export default function AdminBranchesPage() {
  return <BranchesManager />;
}
