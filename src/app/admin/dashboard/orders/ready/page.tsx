import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { OrdersBoard } from '@/components/admin/orders/OrdersBoard';

export const generateMetadata = () => adminMetadata('readyOrders');

export default function AdminReadyOrdersPage() {
  return <OrdersBoard routeView="ready" />;
}
