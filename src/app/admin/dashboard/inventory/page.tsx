import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { Inventory } from '@/components/admin/inventory/Inventory';

export const generateMetadata = () => adminMetadata('inventory');

/** /admin/dashboard/inventory/: the branch's stock, ingredients, wastage and ledger. */
export default function AdminInventoryPage() {
  return <Inventory />;
}
