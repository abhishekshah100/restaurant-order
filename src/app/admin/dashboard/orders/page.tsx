import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { OrdersBoard } from '@/components/admin/orders/OrdersBoard';

export const generateMetadata = () => adminMetadata('orders');

/** The view (Active by default) comes from ?view= on the client. */
export default function AdminOrdersPage() {
  return <OrdersBoard />;
}
