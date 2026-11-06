import type { IconName } from '@/components/ui/Icon/iconNames';
import type { AdminServiceCounts, StaffPermission } from '@/types/admin';
import type { StockAlertsResponse } from '@/types/inventory';
import type { OrderView } from './adminOrders';
import type { PaymentsView } from './adminPayments';
import type { DayRange } from './dayRange';
import { ADMIN_PATHS } from './adminBranches';

/*
 * The admin navigation, one list for every layout: the desktop sidebar shows every item; the
 * mobile tab bar shows the `tab` items and puts the rest in its More sheet. Labels are content
 * keys (common › adminShell.nav.<id>). Each page shows for its own permissions (`needs`) and the
 * server lets those read what the page shows (access-catalog › READERS), so a role opens exactly
 * the pages its permissions name.
 */

export type AdminNavId =
  | 'home'
  | 'tables'
  | 'reservations'
  | 'orders'
  | 'requests'
  | 'kitchen'
  | 'menu'
  | 'payments'
  | 'cash'
  | 'refunds'
  | 'inventory'
  | 'purchasing'
  | 'settings';

/**
 * What the nav's badges count: the floor's counts (for staff who see the floor) and the stock
 * alerts (for staff with inventory), each when known.
 */
export interface NavCounts {
  service?: AdminServiceCounts;
  stock?: Pick<StockAlertsResponse, 'low' | 'out' | 'expiring' | 'expired'>;
}

/** The permissions that read the stock alerts (the server's READERS.inventoryList). */
export const INVENTORY_READERS: readonly StaffPermission[] = [
  'inventory.view',
  'inventory.manage',
  'inventory.adjust',
  'inventory.wastage',
  'inventory.count',
];

/** The permissions that open purchasing (the server's READERS.purchasing). */
export const PURCHASING_READERS: readonly StaffPermission[] = [
  'purchase.view',
  'purchase.manage',
  'purchase.approve',
  'purchase.receive',
];

export interface AdminNavItem {
  id: AdminNavId;
  href: string;
  icon: IconName;
  /** On the mobile tab bar (else in More). */
  tab: boolean;
  /** The live count shown beside it, if any (0 while what it counts isn't known). */
  badge?: (counts: NavCounts) => number;
  /** Shown to staff holding any of these at the branch (everyone, without). */
  needs?: readonly StaffPermission[];
}

const section = (id: string) => `${ADMIN_PATHS.dashboard}${id}/`;

export const ADMIN_NAV: readonly AdminNavItem[] = [
  // The floor's home: the queue of what's waiting on the floor.
  { id: 'home', href: ADMIN_PATHS.dashboard, icon: 'home', tab: true, needs: ['orders.view'] },
  { id: 'tables', href: section('tables'), icon: 'table', tab: true, needs: ['orders.view'] },
  {
    id: 'orders',
    href: section('orders'),
    icon: 'receipt',
    tab: true,
    badge: ({ service }) => service?.readyToServe ?? 0,
    needs: ['orders.view'],
  },
  {
    id: 'requests',
    href: section('requests'),
    icon: 'bell',
    tab: true,
    badge: ({ service }) =>
      service ? service.waiterCalls + service.billRequests + (service.kitchenMessages ?? 0) : 0,
    needs: ['orders.view'],
  },
  {
    id: 'reservations',
    href: section('reservations'),
    icon: 'calendar',
    tab: false,
    needs: ['reservations.manage'],
  },
  // The kitchen has its own workspace (lib/kitchenNav), outside this shell.
  { id: 'kitchen', href: ADMIN_PATHS.kitchen, icon: 'chef', tab: false, needs: ['kitchen.update'] },
  {
    id: 'menu',
    href: section('menu'),
    icon: 'menu',
    tab: false,
    needs: ['menu.manage', 'menu.availability.update'],
  },
  {
    id: 'payments',
    href: section('payments'),
    icon: 'card',
    tab: false,
    needs: ['payments.collect', 'reports.view'],
  },
  {
    id: 'refunds',
    href: section('refunds'),
    icon: 'refresh',
    tab: false,
    needs: ['refunds.give', 'orders.cancel', 'reports.view'],
  },
  {
    id: 'cash',
    href: section('cash'),
    icon: 'cash',
    tab: false,
    needs: ['cash.manage', 'cash.review'],
  },
  {
    id: 'inventory',
    href: section('inventory'),
    icon: 'bag',
    tab: false,
    badge: ({ stock }) => (stock ? stock.low + stock.out + stock.expiring + stock.expired : 0),
    needs: INVENTORY_READERS,
  },
  {
    id: 'purchasing',
    href: section('purchasing'),
    icon: 'tag',
    tab: false,
    needs: PURCHASING_READERS,
  },
  {
    id: 'settings',
    href: section('settings'),
    icon: 'sliders',
    tab: false,
    needs: ['branch.settings.manage', 'tables.manage', 'branches.manage', 'staff.manage'],
  },
];

/** The nav items a staff member may open (`can` from useAdminWorkspace). */
export const navFor = (can: (...permissions: StaffPermission[]) => boolean) =>
  ADMIN_NAV.filter((item) => !item.needs || can(...item.needs));

/**
 * Where a staff member starts at a branch, from what they may do there: the floor's home, else the
 * kitchen, else the first page of the nav they can open. Undefined: nothing there is theirs.
 */
export function landingFor(can: (...permissions: StaffPermission[]) => boolean) {
  const open = navFor(can);
  return (
    open.find((item) => item.id === 'home') ??
    open.find((item) => item.id === 'kitchen') ??
    open[0]
  )?.href;
}

/** The first page of the admin shell (not the kitchen's) they can open: the kitchen's way back. */
export const adminHomeFor = (can: (...permissions: StaffPermission[]) => boolean) =>
  navFor(can).find((item) => item.id !== 'kitchen')?.href;

/** The pages a permission opens (its nav items): what the role form says it gives. */
export const pagesOf = (permission: StaffPermission): AdminNavId[] =>
  ADMIN_NAV.filter((item) => item.needs?.includes(permission)).map((item) => item.id);

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

/**
 * What a pathname's page needs (any of): its nav item's, and Table QR codes the floor plan's
 * (they're printed from the tables the plan sets up). Undefined: anyone at the branch.
 */
export function pageNeeds(pathname: string): readonly StaffPermission[] | undefined {
  if (withSlash(pathname).startsWith(qrCodesPath())) return ['tables.manage'];
  const id = activeNavId(pathname);
  return ADMIN_NAV.find((item) => item.id === id)?.needs;
}

/** Where the waiter home's counters lead. */
export const ADMIN_LINKS = {
  requests: section('requests'),
  tables: section('tables'),
  reservations: section('reservations'),
  reservationHistory: `${section('reservations')}history/`,
  readyOrders: `${section('orders')}ready/`,
  unpaidOrders: `${section('orders')}unpaid/`,
  settings: section('settings'),
  cash: section('cash'),
} as const;

/** A settings page: /admin/dashboard/settings/floor-plan/. */
export const settingsPath = (page: string) => `${ADMIN_LINKS.settings}${page}/`;

/** The Reservations page on a day (?day=2026-10-17); today without one. */
export const reservationsPath = (day?: string) =>
  day ? `${ADMIN_LINKS.reservations}?day=${encodeURIComponent(day)}` : ADMIN_LINKS.reservations;

/** Reservations › History on the days picked (?from=&to=); the last 30 days without them. */
export const reservationHistoryPath = (range?: DayRange) =>
  range
    ? `${ADMIN_LINKS.reservationHistory}?from=${range.from}&to=${range.to}`
    : ADMIN_LINKS.reservationHistory;

/** Every table's QR code, to print. */
export const qrCodesPath = () => `${ADMIN_LINKS.tables}qr/`;

/**
 * A table's page: /admin/dashboard/tables/view/?table=5. One page for every table (it reads the
 * number), so tables added in Settings › Floor plan open without a new build.
 */
export const tablePath = (table: number) => `${ADMIN_LINKS.tables}view/?table=${table}`;

/** A table's order history: /admin/dashboard/tables/history/?table=5 (and the days picked). */
export const tableHistoryPath = (table: number, range?: DayRange) =>
  `${ADMIN_LINKS.tables}history/?table=${table}${range ? `&from=${range.from}&to=${range.to}` : ''}`;

/** The floor plan open on an area: /admin/dashboard/tables/?floor=first. */
export const floorPath = (floorId: string) =>
  `${ADMIN_LINKS.tables}?floor=${encodeURIComponent(floorId)}`;

/**
 * An Orders view on the Orders page (?view=), so switching views keeps the page and its filters,
 * on today or on the days given (?from=&to=). The home's counters link to the ready/ and unpaid/
 * pages, which open on those views.
 */
export function ordersPath(view: OrderView, days?: DayRange): string {
  const search = new URLSearchParams();
  if (view !== 'active') search.set('view', view);
  if (days) {
    search.set('from', days.from);
    search.set('to', days.to);
  }
  const query = search.toString();
  return query ? `${section('orders')}?${query}` : section('orders');
}

/**
 * The Payments page on a view (To collect is the page itself, the others ?view=), on today or
 * on the days given (?from=&to=).
 */
export function paymentsPath(view: PaymentsView = 'collect', days?: DayRange): string {
  const search = new URLSearchParams();
  if (view !== 'collect') search.set('view', view);
  if (days) {
    search.set('from', days.from);
    search.set('to', days.to);
  }
  const query = search.toString();
  return query ? `${section('payments')}?${query}` : section('payments');
}
