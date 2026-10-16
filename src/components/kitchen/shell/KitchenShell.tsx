'use client';

import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { WorkspaceGate } from '@/components/admin/shell/AdminShell';
import { KitchenBar } from './KitchenBar';
import styles from './KitchenShell.module.css';

/** The page's colours while the session and branch are checked, so nothing flashes. */
function KitchenFallback() {
  const t = useContent('kitchen');
  return (
    <div className={styles.fallback} aria-busy="true">
      <span className="visually-hidden" role="status">
        {t('loading')}
      </span>
    </div>
  );
}

/**
 * Every /admin/kitchen-dashboard/ page: the same staff sign-in and branch as the admin dashboard
 * (WorkspaceGate), then the kitchen's bar and the page, full width for the tickets. Rendered
 * once by the route's layout, so it stays put while the kitchen moves between pages.
 */
export function KitchenShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceGate fallback={<KitchenFallback />}>
      <div className={styles.shell}>
        <KitchenBar />
        <main id="main" className={styles.main}>
          {children}
        </main>
      </div>
    </WorkspaceGate>
  );
}
