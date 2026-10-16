'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useContent, useRestaurant } from '@/api/hooks';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { BranchStatusControl } from '@/components/admin/shell/BranchStatusControl';
import { useShellActions } from '@/components/admin/shell/useShellActions';
import { Dialog, Icon } from '@/components/ui';
import { useAdminName } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { ADMIN_PATHS } from '@/lib/adminBranches';
import { cx } from '@/lib/cx';
import { KITCHEN_NAV, KITCHEN_PATHS, activeKitchenNavId } from '@/lib/kitchenNav';
import { useFullscreen } from './useFullscreen';
import styles from './KitchenBar.module.css';

/** The clock in the bar moves on this often. */
const CLOCK_REFRESH_MS = 15_000;

/**
 * The kitchen's bar, in the admin bar's colours: the brand and "Kitchen", the branch and its
 * status (which the kitchen can pause when it's swamped), the kitchen's pages and Admin dashboard
 * beside them, the branch's
 * local time, full screen, and the account menu (the admin dashboard, switch branch, sign out).
 * Below 1024px the pages sit in a row under the rest.
 */
export function KitchenBar() {
  const t = useContent('kitchen');
  const restaurant = useRestaurant();
  const pathname = usePathname();
  const { branch, clock, canSwitch } = useAdminWorkspace();
  const adminName = useAdminName();
  const { signOut, switchBranch } = useShellActions();
  const fullscreen = useFullscreen();
  const now = useNow(CLOCK_REFRESH_MS);
  const [menuOpen, setMenuOpen] = useState(false);
  const active = activeKitchenNavId(pathname);
  const time = now ? clock.time(now) : null;
  const close = () => setMenuOpen(false);

  return (
    <header className={styles.bar}>
      <Link
        href={KITCHEN_PATHS.board}
        className={styles.brand}
        aria-label={t('homeLink', { name: restaurant.name })}
      >
        <span className={styles.mark} aria-hidden="true">
          <Icon name="chef" size="md" />
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>{restaurant.name}</span>
          <span className={styles.descriptor}>{t('descriptor')}</span>
        </span>
      </Link>

      <section className={styles.branch} aria-label={t('bar.branch')}>
        <p className={styles.branchName}>{branch.shortName}</p>
        <BranchStatusControl onDark />
      </section>

      <nav className={styles.nav} aria-label={t('nav.label')}>
        <ul>
          {KITCHEN_NAV.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cx(styles.tab, active === item.id && styles.active)}
                aria-current={active === item.id ? 'page' : undefined}
              >
                <Icon name={item.icon} size="sm" />
                {t(`nav.${item.id}`)}
              </Link>
            </li>
          ))}
          {/* Back to the waiter / admin pages in one tap (also in the account menu). */}
          <li className={styles.adminItem}>
            <Link href={ADMIN_PATHS.dashboard} className={styles.adminLink}>
              <Icon name="home" size="sm" />
              {t('bar.admin')}
            </Link>
          </li>
        </ul>
      </nav>

      <div className={styles.end}>
        {/* Below 1024px the tabs have no room for it, so it sits up here. */}
        <Link
          href={ADMIN_PATHS.dashboard}
          className={cx(styles.adminLink, styles.adminTop)}
          aria-label={t('bar.admin')}
        >
          <Icon name="home" size="sm" />
          {t('bar.adminShort')}
        </Link>
        {time && (
          <p className={styles.clock}>
            <span aria-hidden="true">{time}</span>
            <span className="visually-hidden">{t('bar.time', { time })}</span>
          </p>
        )}
        {fullscreen.supported && (
          <button
            type="button"
            className={styles.fullscreen}
            onClick={fullscreen.toggle}
            aria-pressed={fullscreen.active}
          >
            {fullscreen.active ? t('bar.exitFullscreen') : t('bar.fullscreen')}
          </button>
        )}
        <button
          type="button"
          className={styles.avatar}
          onClick={() => setMenuOpen(true)}
          aria-label={t('bar.account')}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
        >
          <span aria-hidden="true">{adminName?.charAt(0).toUpperCase() ?? ''}</span>
        </button>
      </div>

      <Dialog open={menuOpen} onClose={close} title={t('account.title')} presentation="adaptive">
        <div className={styles.menu}>
          {adminName && (
            <p className={styles.account}>
              <span className={styles.menuAvatar} aria-hidden="true">
                {adminName.charAt(0).toUpperCase()}
              </span>
              {t('account.signedIn', { name: adminName })}
            </p>
          )}
          <Link href={ADMIN_PATHS.dashboard} className={styles.row} onClick={close}>
            <span className={styles.rowIcon}>
              <Icon name="home" size="sm" />
            </span>
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{t('account.admin')}</span>
              <span className={styles.rowSub}>{t('account.adminSub')}</span>
            </span>
            <Icon name="chev" size="xs" className={styles.chev} />
          </Link>
          {canSwitch && (
            <button
              type="button"
              className={styles.row}
              onClick={() => {
                close();
                switchBranch();
              }}
            >
              <span className={styles.rowIcon}>
                <Icon name="swap" size="sm" />
              </span>
              <span className={styles.rowLabel}>{t('account.switch')}</span>
              <Icon name="chev" size="xs" className={styles.chev} />
            </button>
          )}
          <button
            type="button"
            className={cx(styles.row, styles.signOut)}
            onClick={() => {
              close();
              signOut();
            }}
          >
            <span className={styles.rowIcon}>
              <Icon name="logout" size="sm" />
            </span>
            <span className={styles.rowLabel}>{t('account.signOut')}</span>
          </button>
        </div>
      </Dialog>
    </header>
  );
}
