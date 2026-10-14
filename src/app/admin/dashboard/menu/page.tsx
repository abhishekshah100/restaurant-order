import type { Metadata } from 'next';
import { AdminDashboardRoute } from '@/components/admin/AdminDashboardRoute';

export const metadata: Metadata = {
  title: 'Menu · Admin',
  robots: { index: false, follow: false },
};

export default function AdminMenuPage() {
  return <AdminDashboardRoute section="menu" />;
}
