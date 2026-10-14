import type { IconName } from '@/components/ui/Icon/iconNames';
import type { AdminServiceCounts } from '@/types/admin';
import { ADMIN_PATHS } from './adminBranches';

/*
 * The admin navigation, one list for every layout: the desktop sidebar shows every item; the
 * mobile tab bar shows the `tab` items and puts the rest in its More sheet. Labels are content
 * keys (common › adminShell.nav.<id>).
 */

export type AdminNavId = 'home' | 'tables' | 'orders' | 'requests' | 'menu' | 'payments';

export interface AdminNavItem {
  id: AdminNavId;
  href: string;
  icon: IconName;
  /** On the mobile tab bar (else in More). */
  tab: boolean;
  /** The live count shown beside it, if any. */
  badge?: (counts: AdminServiceCounts) => number;
}

const section = (id: string) => `${ADMIN_PATHS.dashboard}${id}/`;

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { id: 'home', href: ADMIN_PATHS.dashboard, icon: 'home', tab: true },
  { id: 'tables', href: section('tables'), icon: 'table', tab: true },
  {
    id: 'orders',
    href: section('orders'),
    icon: 'receipt',
    tab: true,
    badge: (counts) => counts.readyToServe,
  },
  {
    id: 'requests',
    href: section('requests'),
    icon: 'bell',
    tab: true,
    badge: (counts) => counts.waiterCalls + counts.billRequests,
  },
  { id: 'menu', href: section('menu'), icon: 'menu', tab: false },
  { id: 'payments', href: section('payments'), icon: 'card', tab: false },
];

/** "/admin/dashboard/orders/ready" and "/admin/dashboard/orders/ready/" alike. */
const withSlash = (path: string) => `${path.replace(/\/+$/, '')}/`;

/**
 * The nav item a pathname belongs to: its own page or a page under it (Orders for
 * /admin/dashboard/orders/ready/); Home only for the dashboard itself. Undefined elsewhere.
 */
export function activeNavId(pathname: string): AdminNavId | undefined {
  const path = withSlash(pathname);
  if (path === ADMIN_PATHS.dashboard) return 'home';
  return ADMIN_NAV.find((item) => item.id !== 'home' && path.startsWith(item.href))?.id;
}

/** Where the waiter home's counters lead. */
export const ADMIN_LINKS = {
  requests: section('requests'),
  tables: section('tables'),
  readyOrders: `${section('orders')}ready/`,
  unpaidOrders: `${section('orders')}unpaid/`,
} as const;
