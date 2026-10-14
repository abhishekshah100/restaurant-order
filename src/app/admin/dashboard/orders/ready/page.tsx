import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { OrdersSection } from '@/components/admin/sections/OrdersSection';

export const generateMetadata = () => adminMetadata('readyOrders');

export default function AdminReadyOrdersPage() {
  return <OrdersSection filter="ready" />;
}
