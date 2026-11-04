import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { CashRegister } from '@/components/admin/cash/CashRegister';

export const generateMetadata = () => adminMetadata('cash');

/** /admin/dashboard/cash/: the branch's cash register. */
export default function AdminCashPage() {
  return <CashRegister />;
}
