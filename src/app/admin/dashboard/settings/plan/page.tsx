import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { PlanSettings } from '@/components/admin/settings/PlanSettings';

export const generateMetadata = () => adminMetadata('plan');

export default function AdminPlanPage() {
  return <PlanSettings />;
}
