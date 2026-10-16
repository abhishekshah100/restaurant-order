import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { FloorPlanEditor } from '@/components/admin/settings/floorPlan/FloorPlanEditor';

export const generateMetadata = () => adminMetadata('floorPlan');

export default function AdminFloorPlanPage() {
  return <FloorPlanEditor />;
}
