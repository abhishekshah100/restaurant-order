'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { Icon } from '@/components/ui';
import { ADMIN_NAV, type AdminNavId } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import type { AdminServiceCounts } from '@/types/admin';
import { NavBadge } from './NavBadge';
import styles from './MobileNav.module.css';

// Downloaded the first time it opens.
const MobileNavMore = dynamic(() => import('./MobileNavMore').then((m) => m.MobileNavMore), {
  ssr: false,
  loading: () => <LoadingSignal />,
});

export interface MobileNavProps {
  active: AdminNavId | undefined;
  counts: AdminServiceCounts | undefined;
  adminName: string | undefined;
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  onSwitchBranch: () => void;
  onSignOut: () => void;
}

const TABS = ADMIN_NAV.filter((item) => item.tab);
const MORE = ADMIN_NAV.filter((item) => !item.tab);

/**
 * The phone and tablet navigation (below 1024px): a bottom tab bar with the pages waiters use
 * most, and More (a sheet) with the rest, Switch branch and Sign out.
 */
export function MobileNav({
  active,
  counts,
  adminName,
  moreOpen,
  onMoreOpenChange,
  onSwitchBranch,
  onSignOut,
}: MobileNavProps) {
  const t = useContent('common');
  const inMore = MORE.some((item) => item.id === active);
  const close = () => onMoreOpenChange(false);

  return (
    <>
      <nav className={styles.tabs} aria-label={t('adminShell.nav.label')}>
        <ul>
          {TABS.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cx(styles.tab, active === item.id && styles.active)}
                aria-current={active === item.id ? 'page' : undefined}
              >
                <span className={styles.iconWrap}>
                  <Icon name={item.icon} size="sm" />
                  {item.badge && counts && (
                    <NavBadge id={item.id} count={item.badge(counts)} className={styles.badge} />
                  )}
                </span>
                <span className={styles.label}>{t(`adminShell.nav.${item.id}`)}</span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={cx(styles.tab, inMore && styles.active)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => onMoreOpenChange(true)}
            >
              <span className={styles.iconWrap}>
                <Icon name="dots" size="sm" />
              </span>
              <span className={styles.label}>{t('adminShell.nav.more')}</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <MobileNavMore
          active={active}
          adminName={adminName}
          onClose={close}
          onSwitchBranch={onSwitchBranch}
          onSignOut={onSignOut}
        />
      )}
    </>
  );
}
