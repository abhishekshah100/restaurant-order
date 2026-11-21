'use client';

import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { ADMIN_PATHS } from '@/lib/adminBranches';
import {
  navFor,
  navGroups,
  type AdminNavId,
  type AdminNavItem,
  type NavCounts,
} from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { useAdminWorkspace } from './AdminWorkspace';
import { BranchStatusControl } from './BranchStatusControl';
import { NavBadge } from './NavBadge';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  active: AdminNavId | undefined;
  counts: NavCounts;
  /** The branch's local time ("7:42 PM"); null until known. */
  time: string | null;
  adminName: string | undefined;
  onSwitchBranch: () => void;
  onSignOut: () => void;
}

/**
 * The desktop navigation (1024px and up): brand, current branch, then the pages — Home, the
 * groups under small headings (Service, Money, Manage, Reports), Settings at the foot — and the
 * signed-in admin.
 */
export function Sidebar({
  active,
  counts,
  time,
  adminName,
  onSwitchBranch,
  onSignOut,
}: SidebarProps) {
  const t = useContent('common');
  const { branch, brand, canSwitch, can } = useAdminWorkspace();
  const pages = navFor(can);
  const home = pages.filter((item) => item.group === 'home');
  const settings = pages.filter((item) => item.group === 'settings');
  const link = (item: AdminNavItem) => (
    <li key={item.id}>
      <Link
        href={item.href}
        className={cx(styles.link, active === item.id && styles.active)}
        aria-current={active === item.id ? 'page' : undefined}
      >
        <Icon name={item.icon} size="sm" />
        <span className={styles.label}>{t(`adminShell.nav.${item.id}`)}</span>
        {item.badge && (
          <NavBadge id={item.id} count={item.badge(counts)} className={styles.badge} />
        )}
      </Link>
    </li>
  );

  return (
    <aside className={styles.sidebar}>
      <Link
        href={ADMIN_PATHS.dashboard}
        className={styles.brand}
        aria-label={t('adminShell.homeLink', { name: brand })}
      >
        <span className={styles.mark} aria-hidden="true">
          <Icon name="olive" size="md" />
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>{brand}</span>
          <span className={styles.descriptor}>{t('adminShell.descriptor')}</span>
        </span>
      </Link>

      <section className={styles.branch} aria-label={t('adminShell.branch.label')}>
        <p className={styles.branchName}>{branch.shortName}</p>
        <p className={styles.branchMeta}>
          <BranchStatusControl onDark />
          {time && (
            <span className={styles.time}>
              <span className="visually-hidden">{t('adminShell.branch.timeLabel', { time })}</span>
            </span>
          )}
        </p>
        {/* <p className={styles.city}>{branch.city}</p> */}
        {canSwitch && (
          <button type="button" className={styles.switch} onClick={onSwitchBranch}>
            <Icon name="swap" size="xs" />
            {t('adminShell.branch.switch')}
          </button>
        )}
      </section>

      <nav className={styles.nav} aria-label={t('adminShell.nav.label')}>
        {home.length > 0 && <ul>{home.map(link)}</ul>}
        {navGroups(pages).map(({ group, items }) => (
          <section key={group} className={styles.group} aria-labelledby={`nav-${group}`}>
            {/* A label, not a heading: the page's own headings stay the page's. */}
            <p id={`nav-${group}`} className={styles.groupTitle}>
              {t(`adminShell.nav.groups.${group}`)}
            </p>
            <ul>{items.map(link)}</ul>
          </section>
        ))}
        {settings.length > 0 && <ul className={styles.foot}>{settings.map(link)}</ul>}
      </nav>

      {adminName && (
        <div className={styles.account}>
          <span className={styles.avatar} aria-hidden="true">
            {adminName.charAt(0).toUpperCase()}
          </span>
          <span className={styles.name}>
            <span className="visually-hidden">
              {t('adminShell.account.label', { name: adminName })}
            </span>
            <span aria-hidden="true">{adminName}</span>
          </span>
          <button
            type="button"
            className={styles.signOut}
            onClick={onSignOut}
            aria-label={t('adminShell.account.signOut')}
            title={t('adminShell.account.signOut')}
          >
            <Icon name="logout" size="sm" />
          </button>
        </div>
      )}
    </aside>
  );
}
