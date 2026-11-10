import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { OrderHistory } from '@/components/admin/orders/OrderHistory';

export const generateMetadata = () => adminMetadata('orderHistory');

export default function AdminOrderHistoryPage() {
  return <OrderHistory />;
}
