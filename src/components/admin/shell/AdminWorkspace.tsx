'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useBrandTitle } from '@/hooks/useBrandName';
import { brandName } from '@/lib/branchParts';
import { fileOwner } from '@/lib/fileName';
import { createClock, type Clock } from '@/lib/clock';
import { createMoney, type Money } from '@/lib/money';
import { offFeature } from '@/lib/adminPlan';
import type { AdminNavId } from '@/lib/adminNav';
import type { AdminBranch, StaffPermission } from '@/types/admin';
import type { Branch } from '@/types/branch';

/** What the shell shows of the branch (GET /admin/branches; GET /branches has it too). */
export type WorkspaceBranch = Pick<
  AdminBranch,
  | 'id'
  | 'name'
  | 'shortName'
  | 'city'
  | 'status'
  | 'statusUntil'
  | 'timezone'
  | 'locale'
  | 'permissions'
  | 'features'
  | 'plan'
  | 'fiscalYears'
>;

/** Whether the staff member holds any of these permissions at the branch. */
export type Can = (...permissions: StaffPermission[]) => boolean;

/**
 * `can` for a branch: any of the permissions given. A branch sent without its permissions (the
 * mock, or the region data standing in through a failed refresh) lets everything show: the
 * server checks every action anyway.
 */
export const canAt =
  (branch: Pick<AdminBranch, 'permissions'>): Can =>
  (...permissions) =>
    !branch.permissions || permissions.some((p) => branch.permissions?.includes(p));

/** The branch the admin is working in, for every admin page inside the shell. */
export interface AdminWorkspace {
  /** As GET /admin/branches sent it (its status can differ from GET /branches'). */
  branch: WorkspaceBranch;
  /** The name it goes by (brandName): the bars, QR cards, bills and the tab's title. */
  brand: string;
  /** Downloaded files start with it: the company and the branch, as named now (fileOwner). */
  filePrefix: string;
  /** Its region rules (GET /branches): currency, taxes, tables. */
  region: Branch;
  /** How the branch writes money and times. */
  money: Money;
  clock: Clock;
  /** The admin manages more than one branch (so they can switch). */
  canSwitch: boolean;
  /** They may do any of these at the branch (screens and buttons they can't use are hidden). */
  can: Can;
  /** A page the package leaves out: hidden from the nav. */
  isOff: (id: AdminNavId) => boolean;
}

const AdminWorkspaceContext = createContext<AdminWorkspace | null>(null);

export function AdminWorkspaceProvider({
  branch,
  region,
  canSwitch,
  children,
}: Omit<AdminWorkspace, 'brand' | 'filePrefix' | 'money' | 'clock' | 'can' | 'isOff'> & {
  children: ReactNode;
}) {
  const brand = brandName(branch.name);
  useBrandTitle(brand);
  const value = useMemo(() => {
    const can = canAt(branch);
    return {
      branch,
      brand,
      filePrefix: fileOwner(brand, branch.shortName),
      region,
      canSwitch,
      money: createMoney(region),
      clock: createClock(region),
      can,
      isOff: (id: AdminNavId) => offFeature(branch, id) !== undefined,
    };
  }, [branch, brand, region, canSwitch]);
  return <AdminWorkspaceContext.Provider value={value}>{children}</AdminWorkspaceContext.Provider>;
}

/** The selected branch; only inside the admin shell (AdminShell provides it). */
export function useAdminWorkspace(): AdminWorkspace {
  const workspace = useContext(AdminWorkspaceContext);
  if (!workspace) throw new Error('useAdminWorkspace must be used inside AdminShell');
  return workspace;
}
