import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/shell/AdminShell';

/**
 * Every /admin/dashboard/ route shares one shell (the access check, the navigation and the
 * bar), rendered once here so it stays mounted while the admin moves between pages.
 */
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
