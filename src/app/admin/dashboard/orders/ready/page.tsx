import type { Metadata } from 'next';
import { AdminDashboardRoute } from '@/components/admin/AdminDashboardRoute';

export const metadata: Metadata = {
  title: 'Ready orders · Admin',
  robots: { index: false, follow: false },
};

export default function ReadyOrdersPage() {
  return <AdminDashboardRoute section="orders" orderFilter="ready" />;
}
