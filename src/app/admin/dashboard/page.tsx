import type { Metadata } from 'next';
import { AdminDashboardRoute } from '@/components/admin/AdminDashboardRoute';

export const metadata: Metadata = {
  title: 'Admin dashboard',
  robots: { index: false, follow: false },
};

export default function AdminDashboardPage() {
  return <AdminDashboardRoute section="dashboard" />;
}
