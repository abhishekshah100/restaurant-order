'use client';

import Link from 'next/link';
import { useContent } from '@/api/hooks';
import { Dialog, Icon } from '@/components/ui';
import { navFor, navGroups, splitTabs, type AdminNavId, type NavCounts } from '@/lib/adminNav';
import { cx } from '@/lib/cx';
import { useAdminWorkspace } from './AdminWorkspace';
import { BranchStatusControl } from './BranchStatusControl';
import { NavBadge } from './NavBadge';
import styles from './MobileNav.module.css';

/**
 * The phone navigation's More sheet: who's signed in and where (switch branch), then the pages
 * not on the bottom bar as icon tiles under their group's heading (Service, Money, Manage,
 * Reports; Settings last), each with its count, and Sign out.
 */
export function MobileNavMore({
  active,
  counts,
  adminName,
  onClose: close,
  onSwitchBranch,
  onSignOut,
}: {
  active: AdminNavId | undefined;
  counts: NavCounts;
  adminName: string | undefined;
  onClose: () => void;
  onSwitchBranch: () => void;
  onSignOut: () => void;
}) {
  const t = useContent('common');
  const { branch, canSwitch, can, isOff } = useAdminWorkspace();
  const { more } = splitTabs(navFor(can, isOff));
  const groups = [
    ...navGroups(more),
    ...(more.some((item) => item.group === 'settings')
      ? [{ group: 'settings' as const, items: more.filter((item) => item.group === 'settings') }]
      : []),
  ];

  return (
    <Dialog open onClose={close} title={t('adminShell.more.title')} presentation="sheet">
      <div className={styles.sheet}>
        <section className={styles.who} aria-label={t('adminShell.more.branch')}>
          {adminName && (
            <span className={styles.avatar} aria-hidden="true">
              {adminName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className={styles.whoText}>
            {adminName && (
              <span className={styles.whoName}>
                <span className="visually-hidden">
                  {t('adminShell.account.label', { name: adminName })}
                </span>
                <span aria-hidden="true">{adminName}</span>
              </span>
            )}
            <span className={styles.branchName}>
              {t('adminShell.branch.where', { area: branch.shortName, city: branch.city })}
            </span>
            <BranchStatusControl className={styles.branchStatus} />
          </span>
          {canSwitch && (
            <button
              type="button"
              className={styles.switch}
              onClick={() => {
                close();
                onSwitchBranch();
              }}
            >
              <Icon name="swap" size="xs" />
              {t('adminShell.branch.switch')}
            </button>
          )}
        </section>

        {groups.map(({ group, items }) => (
          <section
            key={group}
            className={styles.tileGroup}
            aria-label={t(`adminShell.nav.groups.${group}`)}
          >
            {/* Settings is its own tile: no heading saying the same above it. */}
            {group !== 'settings' && (
              <p className={styles.groupTitle} aria-hidden="true">
                {t(`adminShell.nav.groups.${group}`)}
              </p>
            )}
            <ul className={styles.tiles}>
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={cx(styles.tile, active === item.id && styles.tileActive)}
                    aria-current={active === item.id ? 'page' : undefined}
                    onClick={close}
                  >
                    <span className={styles.tileIcon}>
                      <Icon name={item.icon} size="md" />
                      {item.badge && (
                        <NavBadge
                          id={item.id}
                          count={item.badge(counts)}
                          className={styles.badge}
                        />
                      )}
                    </span>
                    <span className={styles.tileLabel}>{t(`adminShell.nav.${item.id}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

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
      </div>
    </Dialog>
  );
}
