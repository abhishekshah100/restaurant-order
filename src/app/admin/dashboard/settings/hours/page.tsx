import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { OpeningHoursEditor } from '@/components/admin/settings/hours/OpeningHoursEditor';

export const generateMetadata = () => adminMetadata('openingHours');

export default function AdminOpeningHoursPage() {
  return <OpeningHoursEditor />;
}
