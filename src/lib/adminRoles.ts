import type { RolesResponse } from '@/api/contracts';
import type { AdminRole, StaffPermission } from '@/types/admin';

/*
 * Settings › Roles & permissions: the permissions grouped the way staff think of the work, and
 * the role form. Permission keys have dots ("orders.view"); their words are keyed without
 * (common › adminSettings.roles.permissions.orders_view).
 */

export type PermissionGroupId =
  'service' | 'kitchen' | 'manage' | 'inventory' | 'purchasing' | 'menu' | 'branch' | 'staff';

export const PERMISSION_GROUPS: readonly {
  id: PermissionGroupId;
  permissions: readonly StaffPermission[];
  /** Shown only while the restaurant has this optional module. */
  feature?: 'inventory';
}[] = [
  {
    id: 'service',
    permissions: [
      'orders.view',
      'orders.take',
      'service.respond',
      'payments.collect',
      'cash.manage',
    ],
  },
  { id: 'kitchen', permissions: ['kitchen.update', 'menu.availability.update'] },
  {
    id: 'manage',
    permissions: [
      'orders.cancel',
      'refunds.give',
      'reservations.manage',
      'reports.view',
      'cash.review',
    ],
  },
  {
    id: 'inventory',
    permissions: [
      'inventory.view',
      'inventory.manage',
      'inventory.adjust',
      'inventory.wastage',
      'inventory.count',
    ],
    feature: 'inventory',
  },
  {
    id: 'purchasing',
    permissions: ['purchase.view', 'purchase.manage', 'purchase.approve', 'purchase.receive'],
    feature: 'inventory',
  },
  { id: 'menu', permissions: ['menu.manage', 'tables.manage'] },
  {
    id: 'branch',
    permissions: ['branch.status.update', 'branch.settings.manage', 'branches.manage'],
  },
  { id: 'staff', permissions: ['staff.manage'] },
];

/**
 * The groups a role form shows: those of modules the restaurant doesn't have stay hidden (a role
 * keeps their permissions for when it's switched on). Without `features` (the mock): all.
 */
export const groupsFor = (features: readonly string[] | undefined) =>
  PERMISSION_GROUPS.filter((g) => !g.feature || !features || features.includes(g.feature));

/** The content key of a permission's words: "orders.view" → "orders_view". */
export const permissionWord = (key: StaffPermission) => key.replace(/\./g, '_') as PermissionWord;

export type PermissionWord =
  | 'branch_status_update'
  | 'branch_settings_manage'
  | 'branches_manage'
  | 'staff_manage'
  | 'menu_manage'
  | 'menu_availability_update'
  | 'tables_manage'
  | 'orders_view'
  | 'orders_take'
  | 'orders_cancel'
  | 'refunds_give'
  | 'payments_collect'
  | 'cash_manage'
  | 'cash_review'
  | 'service_respond'
  | 'kitchen_update'
  | 'reservations_manage'
  | 'reports_view'
  | 'inventory_view'
  | 'inventory_manage'
  | 'inventory_adjust'
  | 'inventory_wastage'
  | 'inventory_count'
  | 'purchase_view'
  | 'purchase_manage'
  | 'purchase_approve'
  | 'purchase_receive';

export interface RoleDraft {
  name: string;
  description: string;
  permissions: StaffPermission[];
}

/** The form for a new role, one to change, or a copy of one ("Copy of Waiter"). */
export function roleDraft(from?: AdminRole, copyName?: string): RoleDraft {
  return {
    name: copyName ?? from?.name ?? '',
    description: from?.description ?? '',
    permissions: [...(from?.permissions ?? [])],
  };
}

/** The request for a checked form, its permissions in the catalog's order. */
export function roleInput(draft: RoleDraft) {
  const order = PERMISSION_GROUPS.flatMap((g) => g.permissions);
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    permissions: order.filter((p) => draft.permissions.includes(p)),
  };
}

/** What each permission needs (GET …/roles): the server saves a role with those too. */
export type PermissionNeeds = ReadonlyMap<StaffPermission, readonly StaffPermission[]>;

export const permissionNeeds = (catalog: RolesResponse['permissions']): PermissionNeeds =>
  new Map(catalog.map((p) => [p.key, p.needs]));

/** The permissions with everything they need (as the server will save them). */
export function withNeeds(
  permissions: Iterable<StaffPermission>,
  needs: PermissionNeeds,
): StaffPermission[] {
  const held = new Set<StaffPermission>();
  const add = (p: StaffPermission) => {
    if (held.has(p)) return;
    held.add(p);
    needs.get(p)?.forEach(add);
  };
  for (const p of permissions) add(p);
  return [...held];
}

/** The ticked permissions that need this one (it stays on while any of them is). */
export const neededBy = (
  permission: StaffPermission,
  permissions: readonly StaffPermission[],
  needs: PermissionNeeds,
) => permissions.filter((p) => p !== permission && needs.get(p)?.includes(permission));
