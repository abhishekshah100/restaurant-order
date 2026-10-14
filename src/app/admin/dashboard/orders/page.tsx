import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { OrdersSection } from '@/components/admin/sections/OrdersSection';

export const generateMetadata = () => adminMetadata('orders');

export default function AdminOrdersPage() {
  return <OrdersSection />;
}
