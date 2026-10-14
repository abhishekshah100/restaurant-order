import type { Metadata } from 'next';
import { AdminDashboardRoute } from '@/components/admin/AdminDashboardRoute';

export const metadata: Metadata = {
  title: 'Tables · Admin',
  robots: { index: false, follow: false },
};

export default function AdminTablesPage() {
  return <AdminDashboardRoute section="tables" />;
}
