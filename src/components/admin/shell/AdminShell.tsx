'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminBranches, useBranchService, useBranches, useContent } from '@/api/hooks';
import { useAdminName, useSelectedAdminBranchId } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { branchConfigQuery } from '@/api/queries';
import { activeNavId, landingFor, pageNeeds } from '@/lib/adminNav';
import { joinBranch } from '@/lib/branchParts';
import { AdminAccess } from '../AdminAccess';
import { AdminWorkspaceProvider, useAdminWorkspace } from './AdminWorkspace';
import { MobileNav } from './MobileNav';
import { NoAccess } from './NoAccess';
import { ShellHeader } from './ShellHeader';
import { Sidebar } from './Sidebar';
import { useShellActions } from './useShellActions';
import { useAlertsSetting, useServiceAlerts } from './useServiceAlerts';
import styles from './AdminShell.module.css';
import { useBranchEvents } from '@/api/liveEvents';

/** The frame inside the workspace: navigation for every screen size, the bar and the page. */
function ShellFrame({ children }: { children: ReactNode }) {
  const t = useContent('common');
  const pathname = usePathname();
  const { branch, clock, can } = useAdminWorkspace();
  const adminName = useAdminName();
  const { signOut, switchBranch } = useShellActions();
  // The floor's counts and live changes, for those who may see the floor.
  const floorId = can('orders.view') ? branch.id : undefined;
  const service = useBranchService(floorId).data;
  const counts = service?.counts;
  // What changes at the branch is read again at once (and the pages poll rarely meanwhile).
  useBranchEvents(floorId);
  // A chime, a vibration and a toast for what's new on the floor (food ready, a call, the bill).
  const [alertsOn, setAlertsOn] = useAlertsSetting();
  const alertsNeedTap = useServiceAlerts(service, alertsOn);
  const now = useNow();
  const [moreOpen, setMoreOpen] = useState(false);
  const active = activeNavId(pathname);
  const time = now ? clock.time(now) : null;
  // A page opened by its link that their role here doesn't include.
  const needs = pageNeeds(pathname);
  const allowed = !needs || can(...needs);
  // Home that isn't theirs (the kitchen, say): on to where they start, when there's somewhere.
  const router = useRouter();
  const landing = active === 'home' && !allowed ? landingFor(can) : undefined;
  useEffect(() => {
    if (landing) router.replace(landing);
  }, [landing, router]);

  return (
    <div className={styles.shell}>
      <Sidebar
        active={active}
        counts={counts}
        time={time}
        adminName={adminName}
        onSwitchBranch={switchBranch}
        onSignOut={signOut}
      />
      <div className={styles.body}>
        <ShellHeader
          title={t(`adminShell.nav.${active ?? 'home'}`)}
          menuActive={active === 'menu'}
          time={time}
          adminName={adminName}
          onOpenMore={() => setMoreOpen(true)}
          alerts={{ on: alertsOn, needsTap: alertsNeedTap, onToggle: () => setAlertsOn(!alertsOn) }}
        />
        <main id="main" className={styles.main}>
          {allowed ? children : landing ? null : <NoAccess />}
        </main>
      </div>
      <MobileNav
        active={active}
        counts={counts}
        adminName={adminName}
        moreOpen={moreOpen}
        onMoreOpenChange={setMoreOpen}
        onSwitchBranch={switchBranch}
        onSignOut={signOut}
      />
    </div>
  );
}

/** The selected branch (and its region rules) for the frame; nothing until it's known. */
function Workspace({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const adminBranches = useAdminBranches().data;
  const regions = useBranches();
  const selectedId = useSelectedAdminBranchId();
  const summary = regions.find((b) => b.id === selectedId);
  // Its rules (currency, taxes, payments) for every admin page: read before the frame shows.
  const config = useQuery({ ...branchConfigQuery(summary?.id ?? ''), enabled: !!summary }).data;
  const region = useMemo(
    () => (summary && config ? joinBranch(summary, config) : undefined),
    [summary, config],
  );
  // Through a failed refresh of the admin's branches, the region data stands in.
  const branch = adminBranches?.find((b) => b.id === selectedId) ?? region;
  if (!branch || !region) return fallback;
  return (
    <AdminWorkspaceProvider
      branch={branch}
      region={region}
      canSwitch={(adminBranches?.length ?? 0) > 1}
    >
      {children}
    </AdminWorkspaceProvider>
  );
}

/** The page's colours while the session and branch are checked, so nothing flashes. */
export function ShellFallback() {
  const t = useContent('common');
  return (
    <div className={styles.fallback} aria-busy="true">
      <span className="visually-hidden" role="status">
        {t('adminShell.loading')}
      </span>
    </div>
  );
}

/**
 * A staff workspace in one branch: signed in with a selected branch (AdminAccess), then the
 * branch for everything inside (useAdminWorkspace). The admin shell and the kitchen's both
 * sit inside it; `fallback` shows until it's ready.
 */
export function WorkspaceGate({
  children,
  fallback = <ShellFallback />,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <AdminAccess fallback={fallback}>
      <Workspace fallback={fallback}>{children}</Workspace>
    </AdminAccess>
  );
}

/**
 * Every /admin/dashboard/ page: the branch workspace (WorkspaceGate), then the navigation, the
 * bar and the page. Rendered once by the route's layout, so it stays put while the admin moves
 * between pages.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceGate>
      <ShellFrame>{children}</ShellFrame>
    </WorkspaceGate>
  );
}
