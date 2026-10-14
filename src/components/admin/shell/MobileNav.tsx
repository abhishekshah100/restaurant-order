'use client';

import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Dialog, Icon } from '@/components/ui';
import { ADMIN_NAV, type AdminNavId } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import type { AdminServiceCounts } from '@/types/admin';
import { useAdminWorkspace } from './AdminWorkspace';
import { BranchStatus } from './BranchStatus';
import { NavBadge } from './NavBadge';
import styles from './MobileNav.module.css';

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
  const { branch, canSwitch } = useAdminWorkspace();
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

      <Dialog
        open={moreOpen}
        onClose={close}
        title={t('adminShell.more.title')}
        presentation="sheet"
      >
        <div className={styles.sheet}>
          <ul className={styles.list} aria-label={t('adminShell.more.pages')}>
            {MORE.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cx(styles.row, active === item.id && styles.rowActive)}
                  aria-current={active === item.id ? 'page' : undefined}
                  onClick={close}
                >
                  <span className={styles.rowIcon}>
                    <Icon name={item.icon} size="sm" />
                  </span>
                  <span className={styles.rowLabel}>{t(`adminShell.nav.${item.id}`)}</span>
                  <Icon name="chev" size="xs" className={styles.chev} />
                </Link>
              </li>
            ))}
          </ul>

          <section className={styles.group} aria-label={t('adminShell.more.branch')}>
            <div className={styles.branch}>
              <span className={styles.rowIcon}>
                <Icon name="store" size="sm" />
              </span>
              <span className={styles.branchText}>
                <span className={styles.branchName}>
                  {t('adminShell.branch.where', { area: branch.shortName, city: branch.city })}
                </span>
                <BranchStatus status={branch.status} className={styles.branchStatus} />
              </span>
            </div>
            {canSwitch && (
              <button
                type="button"
                className={styles.row}
                onClick={() => {
                  close();
                  onSwitchBranch();
                }}
              >
                <span className={styles.rowIcon}>
                  <Icon name="swap" size="sm" />
                </span>
                <span className={styles.rowLabel}>{t('adminShell.branch.switch')}</span>
                <Icon name="chev" size="xs" className={styles.chev} />
              </button>
            )}
          </section>

          <section className={styles.group} aria-label={t('adminShell.more.account')}>
            {adminName && (
              <p className={styles.account}>
                <span className={styles.avatar} aria-hidden="true">
                  {adminName.charAt(0).toUpperCase()}
                </span>
                {t('adminShell.account.label', { name: adminName })}
              </p>
            )}
            <button
              type="button"
              className={cx(styles.row, styles.signOut)}
              onClick={() => {
                close();
                onSignOut();
              }}
            >
              <span className={styles.rowIcon}>
                <Icon name="logout" size="sm" />
              </span>
              <span className={styles.rowLabel}>{t('adminShell.account.signOut')}</span>
            </button>
          </section>
        </div>
      </Dialog>
    </>
  );
}
