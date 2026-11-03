import type { IconName } from '@/components/ui/Icon/iconNames';
import type { StaffPermission } from '@/types/admin';
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
  /** Shown to staff holding any of these at the branch. */
  needs: readonly StaffPermission[];
}

export const KITCHEN_PATHS = {
  board: ADMIN_PATHS.kitchen,
  stock: `${ADMIN_PATHS.kitchen}stock/`,
  activity: `${ADMIN_PATHS.kitchen}activity/`,
} as const;

export const KITCHEN_NAV: readonly KitchenNavItem[] = [
  { id: 'board', href: KITCHEN_PATHS.board, icon: 'chef', needs: ['kitchen.update'] },
  { id: 'stock', href: KITCHEN_PATHS.stock, icon: 'list', needs: ['menu.availability.update'] },
  { id: 'activity', href: KITCHEN_PATHS.activity, icon: 'history', needs: ['kitchen.update'] },
];

/** The kitchen pages a staff member may open (`can` from useAdminWorkspace). */
export const kitchenNavFor = (can: (...permissions: StaffPermission[]) => boolean) =>
  KITCHEN_NAV.filter((item) => can(...item.needs));

/** The kitchen page a pathname is on (with or without its trailing slash); the board by default. */
export function activeKitchenNavId(pathname: string): KitchenNavId {
  const path = `${pathname.replace(/\/+$/, '')}/`;
  return (
    KITCHEN_NAV.find((item) => item.id !== 'board' && path.startsWith(item.href))?.id ?? 'board'
  );
}
