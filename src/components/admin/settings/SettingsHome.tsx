'use client';

import Link from 'next/link';
import { useContent, useFloorLayout } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { SETTINGS_GROUPS, type SettingsSectionId } from '@/lib/adminSettings';
import { layoutTotals } from '@/lib/floorLayout';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './SettingsHome.module.css';

/**
 * /admin/dashboard/settings/: every setting by group, each as a card with what it holds now
 * (the floor plan: its areas, tables and seats) that opens its page.
 */
export function SettingsHome() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const summaries = useSummaries();

  return (
    <div className={styles.home}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('adminSettings.title')}</h1>
        <p className={styles.subtitle}>
          {t('adminSettings.subtitle', { branch: branch.shortName })}
        </p>
      </header>
      {SETTINGS_GROUPS.map((group) => (
        <section key={group.id} className={styles.group} aria-labelledby={`settings-${group.id}`}>
          <h2 id={`settings-${group.id}`} className={styles.groupTitle}>
            {t(`adminSettings.groups.${group.id}`)}
          </h2>
          <ul className={styles.cards}>
            {group.sections.map((section) => (
              <li key={section.id}>
                <Link href={section.href} className={styles.card}>
                  <span className={styles.icon} aria-hidden="true">
                    <Icon name={section.icon} size="md" />
                  </span>
                  <span className={styles.body}>
                    <span className={styles.cardTitle}>
                      {t(`adminSettings.sections.${section.id}.title`)}
                    </span>
                    <span className={styles.description}>
                      {t(`adminSettings.sections.${section.id}.description`)}
                    </span>
                    {summaries[section.id] && (
                      <span className={styles.summary}>{summaries[section.id]}</span>
                    )}
                  </span>
                  <span className={styles.open}>
                    {t('adminSettings.open')}
                    <Icon name="chev" size="xs" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** What each setting holds now, in a line, once it's read. */
function useSummaries(): Partial<Record<SettingsSectionId, string>> {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const layout = useFloorLayout(branch.id).data;
  if (!layout) return {};
  const totals = layoutTotals(layout);
  return {
    floorPlan: t('adminSettings.sections.floorPlan.summary', {
      areas: t.plural('adminSettings.counts.areas', totals.areas),
      tables: t.plural('adminSettings.counts.tables', totals.tables),
      seats: t.plural('adminSettings.counts.seats', totals.seats),
    }),
  };
}
