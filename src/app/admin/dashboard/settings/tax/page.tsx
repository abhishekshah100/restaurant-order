import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { TaxEditor } from '@/components/admin/settings/tax/TaxEditor';

export const generateMetadata = () => adminMetadata('tax');

export default function AdminTaxPage() {
  return <TaxEditor />;
}
