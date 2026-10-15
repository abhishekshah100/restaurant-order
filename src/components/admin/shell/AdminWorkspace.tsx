'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createClock, type Clock } from '@/lib/clock';
import { createMoney, type Money } from '@/lib/money';
import type { AdminBranch } from '@/types/admin';
import type { Branch } from '@/types/branch';

/** What the shell shows of the branch (GET /admin/branches; GET /branches has it too). */
export type WorkspaceBranch = Pick<
  AdminBranch,
  'id' | 'name' | 'shortName' | 'city' | 'status' | 'statusUntil' | 'timezone' | 'locale'
>;

/** The branch the admin is working in, for every admin page inside the shell. */
export interface AdminWorkspace {
  /** As GET /admin/branches sent it (its status can differ from GET /branches'). */
  branch: WorkspaceBranch;
  /** Its region rules (GET /branches): currency, taxes, tables. */
  region: Branch;
  /** How the branch writes money and times. */
  money: Money;
  clock: Clock;
  /** The admin manages more than one branch (so they can switch). */
  canSwitch: boolean;
}

const AdminWorkspaceContext = createContext<AdminWorkspace | null>(null);

export function AdminWorkspaceProvider({
  branch,
  region,
  canSwitch,
  children,
}: Omit<AdminWorkspace, 'money' | 'clock'> & { children: ReactNode }) {
  const value = useMemo(
    () => ({ branch, region, canSwitch, money: createMoney(region), clock: createClock(region) }),
    [branch, region, canSwitch],
  );
  return <AdminWorkspaceContext.Provider value={value}>{children}</AdminWorkspaceContext.Provider>;
}

/** The selected branch; only inside the admin shell (AdminShell provides it). */
export function useAdminWorkspace(): AdminWorkspace {
  const workspace = useContext(AdminWorkspaceContext);
  if (!workspace) throw new Error('useAdminWorkspace must be used inside AdminShell');
  return workspace;
}
