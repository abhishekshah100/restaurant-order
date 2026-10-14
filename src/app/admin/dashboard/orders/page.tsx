import type { Metadata } from 'next';
import { AdminDashboardRoute } from '@/components/admin/AdminDashboardRoute';

export const metadata: Metadata = {
  title: 'Orders · Admin',
  robots: { index: false, follow: false },
};

export default function AdminOrdersPage() {
  return <AdminDashboardRoute section="orders" />;
}
