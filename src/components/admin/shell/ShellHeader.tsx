'use client';

import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { ADMIN_PATHS } from '@/lib/adminBranches';
import { ADMIN_NAV } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { useAdminWorkspace } from './AdminWorkspace';
import { BranchStatusControl } from './BranchStatusControl';
import styles from './ShellHeader.module.css';

/** The Menu page, a tap away from every admin page (waiters check what's sold out). */
const MENU = ADMIN_NAV.find((item) => item.id === 'menu');

export interface ShellHeaderProps {
  /** The current page's name. */
  title: string;
  /** The Menu page is the one open. */
  menuActive: boolean;
  /** The branch's local time; null until known. */
  time: string | null;
  adminName: string | undefined;
  /** Opens the More sheet (mobile: the avatar). */
  onOpenMore: () => void;
  /** Floor alerts on this device (sound and vibration), and the switch. */
  alerts: { on: boolean; needsTap: boolean; onToggle: () => void };
}

/**
 * The bar over every admin page. Below 1024px: the brand mark, the branch and its status, and
 * Menu and the admin's avatar (which opens More). From 1024px, beside the sidebar: the page
 * title, Menu, the branch status and its local time.
 */
export function ShellHeader({
  title,
  menuActive,
  time,
  adminName,
  onOpenMore,
  alerts,
}: ShellHeaderProps) {
  const t = useContent('common');
  const { branch, brand } = useAdminWorkspace();
  const menuLink = (className: string) =>
    MENU && (
      <Link
        href={MENU.href}
        className={cx(className, menuActive && styles.menuActive)}
        aria-current={menuActive ? 'page' : undefined}
      >
        <Icon name={MENU.icon} size="sm" />
        {t('adminShell.nav.menu')}
      </Link>
    );

  // The bell: on, off, or on but waiting for a tap before the browser lets it play.
  const alertsLabel = !alerts.on
    ? t('adminShell.alerts.off')
    : alerts.needsTap
      ? t('adminShell.alerts.needsTap')
      : t('adminShell.alerts.on');
  const bell = (className: string) => (
    <button
      type="button"
      className={cx(className, alerts.on && alerts.needsTap && styles.bellWaiting)}
      aria-pressed={alerts.on}
      aria-label={alertsLabel}
      title={alertsLabel}
      onClick={alerts.onToggle}
    >
      <Icon name={alerts.on ? 'bell' : 'belloff'} size="sm" />
    </button>
  );

  return (
    <>
      <header className={styles.mobile}>
        <Link
          href={ADMIN_PATHS.dashboard}
          className={styles.mark}
          aria-label={t('adminShell.homeLink', { name: brand })}
        >
          <Icon name="olive" size="md" />
        </Link>
        <div className={styles.branch}>
          <p className={styles.branchName}>{branch.shortName}</p>
          <BranchStatusControl onDark />
        </div>
        {bell(styles.bellMobile)}
        {menuLink(styles.menuMobile)}
        <button
          type="button"
          className={styles.avatar}
          onClick={onOpenMore}
          aria-label={t('adminShell.account.menu')}
        >
          <span aria-hidden="true">{adminName?.charAt(0).toUpperCase() ?? ''}</span>
        </button>
      </header>

      <header className={styles.desktop}>
        <p className={styles.title}>{title}</p>
        <div className={styles.meta}>
          {bell(styles.bellDesktop)}
          {menuLink(styles.menuDesktop)}
          <BranchStatusControl />
          {time && (
            <span className={styles.time}>
              <Icon name="clock" size="xs" />
              <span aria-hidden="true">{time}</span>
              <span className="visually-hidden">{t('adminShell.branch.timeLabel', { time })}</span>
            </span>
          )}
        </div>
      </header>
    </>
  );
}
