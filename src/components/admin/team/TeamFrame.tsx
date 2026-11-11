'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useContent, useRotaRequests } from '@/api/hooks';
import { isBackendEnabled } from '@/api/backend';
import { Tabs } from '@/components/ui';
import { ADMIN_LINKS } from '@/lib/adminNav';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { NoAccess } from '../shell/NoAccess';
import styles from './TeamFrame.module.css';

/** "/admin/dashboard/team/attendance" and ".../attendance/" alike. */
const withSlash = (path: string) => `${path.replace(/\/+$/, '')}/`;

type TeamPage = 'rota' | 'attendance' | 'requests';

/**
 * Team (main menu), three tabs for whoever may open them: Rota (plan the week: `rota.plan`),
 * Attendance (who came and when: `reports.view`, `staff.manage` or `attendance.fix`) and
 * Requests (time off and swaps to answer, with how many wait: `rota.plan`). Someone who opens a
 * tab they can't use goes to the first one they can.
 */
export function TeamFrame({ children }: { children: ReactNode }) {
  const t = useContent('common');
  const router = useRouter();
  const path = withSlash(usePathname());
  const { branch, can } = useAdminWorkspace();
  const plans = can('rota.plan');
  const waiting = useRotaRequests(branch.id, isBackendEnabled() && plans).data?.waiting ?? 0;
  const pages: { id: TeamPage; href: string; count?: number }[] = [
    ...(plans ? [{ id: 'rota' as const, href: ADMIN_LINKS.rota }] : []),
    ...(can('reports.view', 'staff.manage', 'attendance.fix')
      ? [{ id: 'attendance' as const, href: ADMIN_LINKS.attendance }]
      : []),
    ...(plans ? [{ id: 'requests' as const, href: ADMIN_LINKS.teamRequests, count: waiting }] : []),
  ];
  const active: TeamPage = path.startsWith(ADMIN_LINKS.attendance)
    ? 'attendance'
    : path.startsWith(ADMIN_LINKS.teamRequests)
      ? 'requests'
      : 'rota';
  // The old Time sheet address moves itself along (MovedTo): nothing to check there.
  const moving = path.startsWith(`${ADMIN_LINKS.rota}time-sheet/`);
  const allowed = moving || pages.some((p) => p.id === active);
  const elsewhere = !allowed && pages[0]?.href;

  useEffect(() => {
    if (elsewhere) router.replace(elsewhere);
  }, [elsewhere, router]);

  if (!allowed) return elsewhere ? null : <NoAccess />;
  return (
    <div className={styles.frame}>
      {pages.length > 1 && (
        <Tabs
          label={t('adminTeam.tabs.label')}
          value={active}
          items={pages.map((p) => ({
            id: p.id,
            label: t(`adminTeam.tabs.${p.id}`),
            href: p.href,
            count: p.count,
          }))}
        />
      )}
      {children}
    </div>
  );
}
