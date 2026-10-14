import type { DashboardSection } from '@/api/adminDashboard';
import { AdminDashboard } from './AdminDashboard';
import { AdminAccess } from './AdminAccess';

export function AdminDashboardRoute({
  section,
  orderFilter,
}: {
  section: DashboardSection;
  orderFilter?: 'ready' | 'unpaid';
}) {
  return (
    <AdminAccess>
      <AdminDashboard
        key={`${section}:${orderFilter ?? 'all'}`}
        section={section}
        initialOrderFilter={orderFilter}
      />
    </AdminAccess>
  );
}
