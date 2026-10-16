'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { ADMIN_LINKS } from '@/lib/adminNav';
import { SETTINGS_GROUPS, activeSettingsSection } from '@/lib/adminSettings';
import { cx } from '@/lib/cx';
import styles from './SettingsFrame.module.css';

/**
 * Every Settings page's frame: from 1024px the Settings menu (its pages by group) beside the
 * page; on phones a page has Back to Settings above it instead, and the overview is the menu.
 */
export function SettingsFrame({ children }: { children: ReactNode }) {
  const t = useContent('common');
  const active = activeSettingsSection(usePathname());

  return (
    <div className={styles.frame}>
      <nav className={styles.menu} aria-label={t('adminSettings.nav')}>
        <Link
          href={ADMIN_LINKS.settings}
          className={styles.menuTitle}
          aria-current={active ? undefined : 'page'}
        >
          {t('adminSettings.title')}
        </Link>
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.id} className={styles.group}>
            <p className={styles.groupTitle}>{t(`adminSettings.groups.${group.id}`)}</p>
            <ul className={styles.items}>
              {group.sections.map((section) => (
                <li key={section.id}>
                  <Link
                    href={section.href}
                    className={cx(styles.item, active === section.id && styles.current)}
                    aria-current={active === section.id ? 'page' : undefined}
                  >
                    <Icon name={section.icon} size="sm" />
                    {t(`adminSettings.sections.${section.id}.title`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className={styles.content}>
        {active && (
          <Link href={ADMIN_LINKS.settings} className={styles.back}>
            <Icon name="back" size="xs" />
            {t('adminSettings.back')}
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}
