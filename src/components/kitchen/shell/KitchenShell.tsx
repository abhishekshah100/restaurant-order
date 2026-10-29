'use client';

import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { WorkspaceGate } from '@/components/admin/shell/AdminShell';
import { KitchenBar } from './KitchenBar';
import { cx } from '@/lib/cx';
import { useKitchenPrefs } from './useKitchenPrefs';
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
          {children}
        </main>
      </div>
    </WorkspaceGate>
  );
}
