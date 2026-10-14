import type { Metadata } from 'next';
import { getContent } from '@/api/server';

type AdminPage =
  'home' | 'tables' | 'orders' | 'readyOrders' | 'unpaidOrders' | 'menu' | 'requests' | 'payments';

/** An admin page's title (common › adminShell.meta); staff pages are never indexed. */
export async function adminMetadata(page: AdminPage): Promise<Metadata> {
  const t = await getContent('common');
  return { title: t(`adminShell.meta.${page}`), robots: { index: false, follow: false } };
}
