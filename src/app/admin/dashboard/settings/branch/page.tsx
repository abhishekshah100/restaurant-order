import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { BranchDetailsEditor } from '@/components/admin/settings/details/BranchDetailsEditor';

export const generateMetadata = () => adminMetadata('branchDetails');

export default function AdminBranchDetailsPage() {
  return <BranchDetailsEditor />;
}
