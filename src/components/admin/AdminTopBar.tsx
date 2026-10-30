'use client';

import { useContent } from '@/api/hooks';
import { useBrandName, useBrandTitle } from '@/hooks/useBrandName';
import { Icon } from '@/components/ui';
import styles from './AdminTopBar.module.css';

export interface AdminTopBarProps {
  /** The signed-in admin; the account area shows only with a name. */
  adminName?: string;
  onSignOut?: () => void;
}

/** The admin app bar: the brand and "Admin" on the left, the signed-in admin and Sign out on the right. */
export function AdminTopBar({ adminName, onSignOut }: AdminTopBarProps) {
  const t = useContent('common');
  const brand = useBrandName();
  useBrandTitle(brand);
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name="olive" size="md" />
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>{brand}</span>
          <span className={styles.descriptor}>{t('adminLogin.descriptor')}</span>
        </span>
      </div>

      {adminName && (
        <div className={styles.account}>
          <span className={styles.avatar} aria-hidden="true">
            {adminName.charAt(0).toUpperCase()}
          </span>
          <span className="visually-hidden">
            {t('adminSelectBranch.account', { name: adminName })}
          </span>
          <span className={styles.name} aria-hidden="true">
            {adminName}
          </span>
          {onSignOut && (
            <button type="button" className={styles.signOut} onClick={onSignOut}>
              {t('adminSelectBranch.signOut')}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
