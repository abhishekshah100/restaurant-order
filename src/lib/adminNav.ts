import type { IconName } from '@/components/ui/Icon/iconNames';
import type { AdminServiceCounts } from '@/types/admin';
import type { OrderView } from './adminOrders';
import type { PaymentsView } from './adminPayments';
import { ADMIN_PATHS } from './adminBranches';

/*
 * The admin navigation, one list for every layout: the desktop sidebar shows every item; the
 * mobile tab bar shows the `tab` items and puts the rest in its More sheet. Labels are content
 * keys (common › adminShell.nav.<id>).
 */

export type AdminNavId =
  'home' | 'tables' | 'reservations' | 'orders' | 'requests' | 'menu' | 'payments' | 'settings';

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
  { id: 'reservations', href: section('reservations'), icon: 'calendar', tab: false },
  { id: 'menu', href: section('menu'), icon: 'menu', tab: false },
  { id: 'payments', href: section('payments'), icon: 'card', tab: false },
  { id: 'settings', href: section('settings'), icon: 'sliders', tab: false },
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
  reservations: section('reservations'),
  readyOrders: `${section('orders')}ready/`,
  unpaidOrders: `${section('orders')}unpaid/`,
  settings: section('settings'),
} as const;

/** A settings page: /admin/dashboard/settings/floor-plan/. */
export const settingsPath = (page: string) => `${ADMIN_LINKS.settings}${page}/`;

/** The Reservations page on a day (?day=2026-10-17); today without one. */
export const reservationsPath = (day?: string) =>
  day ? `${ADMIN_LINKS.reservations}?day=${encodeURIComponent(day)}` : ADMIN_LINKS.reservations;

/** Every table's QR code, to print. */
export const qrCodesPath = () => `${ADMIN_LINKS.tables}qr/`;

/**
 * A table's page: /admin/dashboard/tables/view/?table=5. One page for every table (it reads the
 * number), so tables added in Settings › Floor plan open without a new build.
 */
export const tablePath = (table: number) => `${ADMIN_LINKS.tables}view/?table=${table}`;

/** The floor plan open on an area: /admin/dashboard/tables/?floor=first. */
export const floorPath = (floorId: string) =>
  `${ADMIN_LINKS.tables}?floor=${encodeURIComponent(floorId)}`;

/**
 * An Orders view on the Orders page (?view=), so switching views keeps the page and its filters.
 * The home's counters link to the ready/ and unpaid/ pages, which open on those views.
 */
export function ordersPath(view: OrderView): string {
  const base = section('orders');
  return view === 'active' ? base : `${base}?view=${view}`;
}

/** The Payments page on a view: To collect is the page itself, the others ?view=. */
export function paymentsPath(view: PaymentsView = 'collect'): string {
  const base = section('payments');
  return view === 'collect' ? base : `${base}?view=${view}`;
}
