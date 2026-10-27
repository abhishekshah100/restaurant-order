'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useContent, useRestaurant } from '@/api/hooks';
import { useBranchEvents } from '@/api/liveEvents';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { BranchStatusControl } from '@/components/admin/shell/BranchStatusControl';
import { useShellActions } from '@/components/admin/shell/useShellActions';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { Icon } from '@/components/ui';
import { useAdminName } from '@/hooks/useAdminSession';
import { useNow } from '@/hooks/useNow';
import { ADMIN_PATHS } from '@/lib/adminBranches';
import { cx } from '@/lib/cx';
import { KITCHEN_NAV, KITCHEN_PATHS, activeKitchenNavId } from '@/lib/kitchenNav';
import { useFullscreen } from './useFullscreen';
import { useKitchenPrefs } from './useKitchenPrefs';
import styles from './KitchenBar.module.css';

// Downloaded the first time it opens.
const KitchenAccountDialog = dynamic(
  () => import('./KitchenAccountDialog').then((m) => m.KitchenAccountDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);
const KitchenSettingsDialog = dynamic(
  () => import('./KitchenSettingsDialog').then((m) => m.KitchenSettingsDialog),
  { ssr: false, loading: () => <LoadingSignal /> },
);

/** The clock in the bar moves on this often. */
const CLOCK_REFRESH_MS = 15_000;

/**
 * The kitchen's bar, near black: the brand and "Kitchen", the branch and its status (which the
 * kitchen can pause when it's swamped), the kitchen's pages and Admin dashboard beside them, the
 * branch's local time, the new-ticket sound on or off, Screen settings, full screen, and the
 * account menu (the admin dashboard, switch branch,
 * sign out). Below 1024px the pages sit in a row under the rest; up to 1440px the brand's name
 * and the labels of Admin dashboard and Full screen give way to their icons.
 */
export function KitchenBar() {
  const t = useContent('kitchen');
  const restaurant = useRestaurant();
  const pathname = usePathname();
  const { branch, clock, canSwitch } = useAdminWorkspace();
  // What changes at the branch reaches the kitchen at once (every kitchen page has the bar).
  useBranchEvents(branch.id);
  const adminName = useAdminName();
  const { signOut, switchBranch } = useShellActions();
  const fullscreen = useFullscreen();
  const [prefs, updatePrefs] = useKitchenPrefs();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
            <Link href={ADMIN_PATHS.dashboard} className={styles.adminLink} title={t('bar.admin')}>
              <Icon name="home" size="sm" />
              <span className={styles.wideOnly}>{t('bar.admin')}</span>
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
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => updatePrefs({ sound: !prefs.sound })}
          aria-pressed={prefs.sound}
          aria-label={prefs.sound ? t('bar.soundOn') : t('bar.soundOff')}
          title={prefs.sound ? t('bar.soundOn') : t('bar.soundOff')}
        >
          <Icon name={prefs.sound ? 'bell' : 'belloff'} size="sm" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setSettingsOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          aria-label={t('bar.settings')}
          title={t('bar.settings')}
        >
          <Icon name="sliders" size="sm" />
        </button>
        {fullscreen.supported && (
          <button
            type="button"
            className={styles.fullscreen}
            onClick={fullscreen.toggle}
            aria-pressed={fullscreen.active}
            title={fullscreen.active ? t('bar.exitFullscreen') : t('bar.fullscreen')}
          >
            <Icon name={fullscreen.active ? 'shrink' : 'expand'} size="sm" />
            <span className={styles.wideOnly}>
              {fullscreen.active ? t('bar.exitFullscreen') : t('bar.fullscreen')}
            </span>
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

      {settingsOpen && <KitchenSettingsDialog onClose={() => setSettingsOpen(false)} />}
      {menuOpen && (
        <KitchenAccountDialog
          adminName={adminName}
          canSwitch={canSwitch}
          onClose={close}
          onSwitchBranch={switchBranch}
          onSignOut={signOut}
        />
      )}
    </header>
  );
}
