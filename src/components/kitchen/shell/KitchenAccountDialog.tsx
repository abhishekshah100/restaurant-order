'use client';

import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Dialog, Icon } from '@/components/ui';
import { ADMIN_PATHS } from '@/lib/adminBranches';
import { cx } from '@/lib/cx';
import styles from './KitchenBar.module.css';

/** The kitchen's account menu: who's signed in, the admin dashboard, switch branch, sign out. */
export function KitchenAccountDialog({
  adminName,
  canSwitch,
  onClose: close,
  onSwitchBranch,
  onSignOut,
}: {
  adminName: string | undefined;
  canSwitch: boolean;
  onClose: () => void;
  onSwitchBranch: () => void;
  onSignOut: () => void;
}) {
  const t = useContent('kitchen');
  return (
    <Dialog open onClose={close} title={t('account.title')} presentation="adaptive">
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
              onSwitchBranch();
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
            onSignOut();
          }}
        >
          <span className={styles.rowIcon}>
            <Icon name="logout" size="sm" />
          </span>
          <span className={styles.rowLabel}>{t('account.signOut')}</span>
        </button>
      </div>
    </Dialog>
  );
}
