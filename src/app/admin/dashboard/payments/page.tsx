import type { Metadata } from 'next';
import { AdminDashboardRoute } from '@/components/admin/AdminDashboardRoute';

export const metadata: Metadata = {
  title: 'Payments · Admin',
  robots: { index: false, follow: false },
};

export default function AdminPaymentsPage() {
  return <AdminDashboardRoute section="payments" />;
}
