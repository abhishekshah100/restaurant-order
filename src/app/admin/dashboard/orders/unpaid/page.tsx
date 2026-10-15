import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { OrdersBoard } from '@/components/admin/orders/OrdersBoard';

export const generateMetadata = () => adminMetadata('unpaidOrders');

export default function AdminUnpaidOrdersPage() {
  return <OrdersBoard routeView="unpaid" />;
}
