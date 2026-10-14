import type { Metadata } from 'next';
import { AdminDashboardRoute } from '@/components/admin/AdminDashboardRoute';

export const metadata: Metadata = {
  title: 'Unpaid orders · Admin',
  robots: { index: false, follow: false },
};

export default function UnpaidOrdersPage() {
  return <AdminDashboardRoute section="orders" orderFilter="unpaid" />;
}
