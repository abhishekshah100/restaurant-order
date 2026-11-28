'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { WorkspaceGate } from '@/components/admin/shell/AdminShell';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { NoAccess } from '@/components/admin/shell/NoAccess';
import { PlanBanner, PlanEnded } from '@/components/admin/shell/PlanScreens';
import { hasFeature, planNotice } from '@/lib/adminPlan';
import { KitchenBar } from './KitchenBar';
import { cx } from '@/lib/cx';
import { KITCHEN_NAV, KITCHEN_PATHS, activeKitchenNavId } from '@/lib/kitchenNav';
import { useKitchenOutboxSender } from '../useKitchenOutbox';
import { useKitchenPrefs } from './useKitchenPrefs';
import { useKitchenKeepAlive } from './useKitchenKeepAlive';
import { useKitchenThemeClass } from './useKitchenTheme';
import { useWakeLock } from './useWakeLock';
import styles from './KitchenShell.module.css';

/** The page's colours while the session and branch are checked, so nothing flashes. */
function KitchenFallback() {
  const t = useContent('kitchen');
  const themeClass = useKitchenThemeClass();
  return (
    <div className={cx(styles.fallback, themeClass)} aria-busy="true">
      <span className="visually-hidden" role="status">
        {t('loading')}
      </span>
    </div>
  );
}

/** A kitchen page for those whose role includes it (kitchenNav › needs); no access for the rest. */
function KitchenPage({ children }: { children: ReactNode }) {
  const { can, branch } = useAdminWorkspace();
  // The kitchen's taps go out from every kitchen page (the board, Stock, Activity).
  useKitchenOutboxSender();
  // Open and on screen, the kitchen keeps the device signed in (an admin tab beside it can't
  // sign it out for being idle).
  useKitchenKeepAlive();
  const active = activeKitchenNavId(usePathname());
  const page = KITCHEN_NAV.find((item) => item.id === active);
  const needs = page?.needs ?? ['kitchen.update'];
  const notice = planNotice(branch.plan);
  // A tab the package leaves out (Stock, Activity), opened by its link: back to the board.
  const off = page?.feature !== undefined && !hasFeature(branch, page.feature);
  const router = useRouter();
  useEffect(() => {
    if (off) router.replace(KITCHEN_PATHS.board);
  }, [off, router]);
  if (off) return null;
  if (!can(...needs)) {
    // Locked by the plan (paused, or ended for pages that aren't the board): say why.
    // (Finishing up after a suspension: the board stays; the rest says why it's closed.)
    return notice?.kind === 'suspended' ||
      notice?.kind === 'finishing' ||
      notice?.kind === 'branchLocked' ||
      notice?.kind === 'expired' ? (
      <PlanEnded />
    ) : (
      <NoAccess />
    );
  }
  return (
    <>
      <PlanBanner />
      {children}
    </>
  );
}

/**
 * Every /admin/kitchen-dashboard/ page: the same staff sign-in and branch as the admin dashboard
 * (WorkspaceGate), then the kitchen's bar and the page, full width for the tickets, in the
 * device's kitchen theme (dark or light, switched from the bar). Rendered
 * once by the route's layout, so it stays put while the kitchen moves between pages.
 */
export function KitchenShell({ children }: { children: ReactNode }) {
  const themeClass = useKitchenThemeClass();
  const [prefs] = useKitchenPrefs();
  // A kitchen screen stays on while the kitchen pages are open (Screen settings).
  useWakeLock(prefs.awake);
  return (
    <WorkspaceGate fallback={<KitchenFallback />}>
      <div className={cx(styles.shell, themeClass)}>
        <KitchenBar />
        <main id="main" className={styles.main}>
          <KitchenPage>{children}</KitchenPage>
        </main>
      </div>
    </WorkspaceGate>
  );
}
