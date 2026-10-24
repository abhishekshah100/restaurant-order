'use client';

import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Dialog, Icon } from '@/components/ui';
import { ADMIN_NAV, type AdminNavId } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { useAdminWorkspace } from './AdminWorkspace';
import { BranchStatusControl } from './BranchStatusControl';
import styles from './MobileNav.module.css';

const MORE = ADMIN_NAV.filter((item) => !item.tab);

/** The phone navigation's More sheet: the other pages, the branch (switch it) and sign out. */
export function MobileNavMore({
  active,
  adminName,
  onClose: close,
  onSwitchBranch,
  onSignOut,
}: {
  active: AdminNavId | undefined;
  adminName: string | undefined;
  onClose: () => void;
  onSwitchBranch: () => void;
  onSignOut: () => void;
}) {
  const t = useContent('common');
  const { branch, canSwitch } = useAdminWorkspace();
  return (
    <Dialog open onClose={close} title={t('adminShell.more.title')} presentation="sheet">
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
              <BranchStatusControl className={styles.branchStatus} />
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
  );
}
