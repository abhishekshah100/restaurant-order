'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { Icon, Tabs } from '@/components/ui';
import { ADMIN_LINKS } from '@/lib/adminNav';
import { activeSettingsSection, canOpenPage, settingsFor, settingsPage } from '@/lib/adminSettings';
import type { PlanFeature } from '@/api/contracts/platform';
import { hasFeature } from '@/lib/adminPlan';
import { cx } from '@/lib/cx';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { NoAccess } from '../shell/NoAccess';
import { usePlatformAdmin } from './usePlatformAdmin';
import styles from './SettingsFrame.module.css';

/**
 * Every Settings page's frame: from 1024px the Settings menu (its sections by group) beside the
 * page; on phones a page has Back to Settings above it instead, and the overview is the menu.
 * A section of several pages shows them as tabs above the page (each keeps its own address).
 */
export function SettingsFrame({ children }: { children: ReactNode }) {
  const t = useContent('common');
  const active = activeSettingsSection(usePathname());
  const { can, branch } = useAdminWorkspace();
  const platform = usePlatformAdmin();
  const has = (feature: PlanFeature) => hasFeature(branch, feature);
  const groups = settingsFor(can, platform, has);
  const page = active ? settingsPage(active) : undefined;
  const allowed = !page || canOpenPage(page, can, platform);
  // A page of a feature the package leaves out (hidden from the menu, opened by its link): back
  // to the Settings overview.
  const off = page?.feature !== undefined && !has(page.feature);
  const router = useRouter();
  useEffect(() => {
    if (off) router.replace(ADMIN_LINKS.settings);
  }, [off, router]);
  // The section this page is in, with the pages (tabs) this staff member may open.
  const topic = active
    ? groups.flatMap((g) => g.topics).find((tp) => tp.pages.some((p) => p.id === active))
    : undefined;

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
        {groups.map((group) => (
          <div key={group.id} className={styles.group}>
            <p className={styles.groupTitle}>{t(`adminSettings.groups.${group.id}`)}</p>
            <ul className={styles.items}>
              {group.topics.map((item) => {
                const current = topic?.id === item.id;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={cx(styles.item, current && styles.current)}
                      aria-current={current ? 'page' : undefined}
                    >
                      <Icon name={item.icon} size="sm" />
                      {t(`adminSettings.topics.${item.id}.title`)}
                    </Link>
                  </li>
                );
              })}
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
        {allowed && topic && topic.pages.length > 1 && active && (
          <Tabs
            className={styles.tabs}
            label={t('adminSettings.tabs.label')}
            value={active}
            items={topic.pages.map((p) => ({
              id: p.id,
              label: t(`adminSettings.tabs.${p.id as TabbedPage}`),
              href: p.href,
            }))}
          />
        )}
        {off ? null : !allowed ? <NoAccess /> : children}
      </div>
    </div>
  );
}

/** The pages that share their section with others (each has a tab label). */
type TabbedPage =
  | 'details'
  | 'help'
  | 'services'
  | 'pickup'
  | 'delivery'
  | 'tax'
  | 'payments'
  | 'staff'
  | 'roles'
  | 'branches'
  | 'modules';
