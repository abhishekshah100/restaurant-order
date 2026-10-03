import type { IconName } from '@/components/ui';

export interface NavItem {
  /** Also the label's key in common.nav. */
  id: 'menu' | 'orders' | 'service';
  href: string;
  icon: IconName;
  /** Path prefixes that mark this item as the current page. */
  match: readonly string[];
}

/** Primary navigation, shared by SiteHeader (desktop) and BottomNav (mobile). */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'menu', href: '/menu/', icon: 'menu', match: ['/menu', '/dish', '/search', '/cart'] },
  { id: 'orders', href: '/orders/', icon: 'list', match: ['/orders', '/order/'] },
  { id: 'service', href: '/help/', icon: 'bell', match: ['/help'] },
];

export const isNavActive = (item: NavItem, pathname: string) =>
  item.match.some((prefix) => pathname.startsWith(prefix));
