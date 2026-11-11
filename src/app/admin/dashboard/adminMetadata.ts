import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import type { Vars } from '@/api/translator';

type AdminPage =
  | 'home'
  | 'tables'
  | 'table'
  | 'tableHistory'
  | 'qrCodes'
  | 'reservations'
  | 'reservationHistory'
  | 'orders'
  | 'readyOrders'
  | 'unpaidOrders'
  | 'orderHistory'
  | 'menu'
  | 'requests'
  | 'requestHistory'
  | 'payments'
  | 'paymentHistory'
  | 'cash'
  | 'refunds'
  | 'inventory'
  | 'purchasing'
  | 'settings'
  | 'floorPlan'
  | 'branchDetails'
  | 'helpPage'
  | 'modules'
  | 'openingHours'
  | 'tax'
  | 'paymentMethods'
  | 'offers'
  | 'roles'
  | 'staff'
  | 'rota'
  | 'attendance'
  | 'teamRequests'
  | 'deliveryZones'
  | 'pickup'
  | 'branches'
  | 'services';

/** An admin page's title (common › adminShell.meta); staff pages are never indexed. */
export async function adminMetadata(page: AdminPage, vars?: Vars): Promise<Metadata> {
  const t = await getContent('common');
  return { title: t(`adminShell.meta.${page}`, vars), robots: { index: false, follow: false } };
}
