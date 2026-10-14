import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { OrdersSection } from '@/components/admin/sections/OrdersSection';

export const generateMetadata = () => adminMetadata('unpaidOrders');

export default function AdminUnpaidOrdersPage() {
  return <OrdersSection filter="unpaid" />;
}
