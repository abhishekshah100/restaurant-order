'use client';

import Link from 'next/link';
import { useAdminBranches, useBranchSettings, useContent, useFloorLayout } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { SETTINGS_GROUPS, type SettingsSectionId } from '@/lib/adminSettings';
import { layoutTotals } from '@/lib/floorLayout';
import { ORDER_MODES } from '@/lib/fulfilment';
import { formatRate } from '@/lib/pricing';
import { WEEKDAYS } from '@/types/branch';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import styles from './SettingsHome.module.css';

/**
 * /admin/dashboard/settings/: every setting by group, each as a card with what it holds now
 * (the floor plan's areas, tables and seats; today's hours; the taxes…) that opens its page.
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
  const cart = useContent('cart');
  const { branch, region } = useAdminWorkspace();
  const layout = useFloorLayout(branch.id).data;
  const settings = useBranchSettings(branch.id).data?.settings;
  const branches = useAdminBranches().data;
  const summaries: Partial<Record<SettingsSectionId, string>> = {};

  if (layout) {
    const totals = layoutTotals(layout);
    summaries.floorPlan = t('adminSettings.sections.floorPlan.summary', {
      areas: t.plural('adminSettings.counts.areas', totals.areas),
      tables: t.plural('adminSettings.counts.tables', totals.tables),
      seats: t.plural('adminSettings.counts.seats', totals.seats),
    });
  }
  if (settings) {
    const { details, services, hours, tax, payments, delivery, pickup } = settings;
    const on = ORDER_MODES.filter((m) => services[m]).map((m) => t(`modes.${m}`));
    summaries.services = on.length
      ? t('adminSettings.sections.services.summary', { modes: on.join(' · ') })
      : t('adminSettings.sections.services.none');
    const openDays = WEEKDAYS.filter((d) => hours.days[d].open).length;
    summaries.details = t('adminSettings.sections.details.summary', {
      area: details.shortName,
      city: details.city,
    });
    summaries.hours = t('adminSettings.sections.hours.summary', {
      days: t.plural('adminSettings.counts.openDays', openDays),
      today: region.hoursToday,
    });
    summaries.tax = t('adminSettings.sections.tax.summary', {
      taxes: tax.lines
        .map((l) => cart(`priceSummary.lines.${l.labelKey}`, { rate: formatRate(l.rateBp) }))
        .join(', '),
      service:
        tax.serviceChargeBp === null
          ? t('adminSettings.sections.tax.serviceNone')
          : t('adminSettings.sections.tax.serviceRate', { rate: formatRate(tax.serviceChargeBp) }),
    });
    summaries.payments = t('adminSettings.sections.payments.summary', {
      count: t.plural('adminSettings.counts.methods', payments.checkout.methods.length),
      bill: t.plural('adminSettings.counts.methods', payments.bill.methods.length),
    });
    summaries.delivery = delivery.enabled
      ? t('adminSettings.sections.delivery.summaryOn', {
          zones: t.plural('adminSettings.counts.zones', delivery.zones.length),
        })
      : t('adminSettings.sections.delivery.summaryOff');
    summaries.pickup = pickup.enabled
      ? t('adminSettings.sections.pickup.summaryOn', { minutes: pickup.slotMinutes })
      : t('adminSettings.sections.pickup.summaryOff');
  }
  if (branches) {
    summaries.branches = t('adminSettings.sections.branches.summary', {
      branches: t.plural('adminSettings.counts.branches', branches.length),
    });
  }
  return summaries;
}
