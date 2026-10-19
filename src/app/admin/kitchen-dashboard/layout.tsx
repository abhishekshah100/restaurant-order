import type { ReactNode } from 'react';
import { KitchenShell } from '@/components/kitchen/shell/KitchenShell';

/**
 * Every /admin/kitchen-dashboard/ route shares one shell (the staff access check, the kitchen bar),
 * rendered once here so it stays mounted while the kitchen moves between pages.
 */
export default function KitchenDashboardLayout({ children }: { children: ReactNode }) {
  return <KitchenShell>{children}</KitchenShell>;
}
