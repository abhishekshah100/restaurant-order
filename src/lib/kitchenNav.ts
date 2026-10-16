import type { IconName } from '@/components/ui/Icon/iconNames';
import { ADMIN_PATHS } from './adminBranches';

/*
 * The kitchen workspace's navigation (/admin/kitchen-dashboard/): one list for the tabs in its bar.
 * Labels are content keys (kitchen › nav.<id>). Add a kitchen page here and it shows in the bar.
 */

export type KitchenNavId = 'board' | 'stock' | 'activity';

export interface KitchenNavItem {
  id: KitchenNavId;
  href: string;
  icon: IconName;
}

export const KITCHEN_PATHS = {
  board: ADMIN_PATHS.kitchen,
  stock: `${ADMIN_PATHS.kitchen}stock/`,
  activity: `${ADMIN_PATHS.kitchen}activity/`,
} as const;

export const KITCHEN_NAV: readonly KitchenNavItem[] = [
  { id: 'board', href: KITCHEN_PATHS.board, icon: 'chef' },
  { id: 'stock', href: KITCHEN_PATHS.stock, icon: 'list' },
  { id: 'activity', href: KITCHEN_PATHS.activity, icon: 'history' },
];

/** The kitchen page a pathname is on (with or without its trailing slash); the board by default. */
export function activeKitchenNavId(pathname: string): KitchenNavId {
  const path = `${pathname.replace(/\/+$/, '')}/`;
  return (
    KITCHEN_NAV.find((item) => item.id !== 'board' && path.startsWith(item.href))?.id ?? 'board'
  );
}
