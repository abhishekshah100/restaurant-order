import type { Metadata } from 'next';
import { AdminDashboardRoute } from '@/components/admin/AdminDashboardRoute';

export const metadata: Metadata = {
  title: 'Customer requests · Admin',
  robots: { index: false, follow: false },
};

export default function AdminRequestsPage() {
  return <AdminDashboardRoute section="requests" />;
}
