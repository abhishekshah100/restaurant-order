'use client';

import type { PlanFeature, PlanLimit } from '@/api/contracts/platform';
import { useContent } from '@/api/hooks';
import { Icon, Tag, type TagVariant } from '@/components/ui';
import { cx } from '@/lib/cx';
import { hasFeature } from '@/lib/adminPlan';
import { useAdminWorkspace } from '../shell/AdminWorkspace';
import { PlanContact } from '../shell/PlanContact';
import { SettingsCard, SettingsNote } from './shared/SettingsEditor';
import editor from './shared/SettingsEditor.module.css';
import styles from './PlanSettings.module.css';

const GROUPS = ['essentials', 'advanced', 'services'] as const;

/** The built-in features, for a server that doesn't send its catalog yet. */
const BUILT_IN: PlanFeature[] = [
  'ordering',
  'takeaway',
  'reports',
  'delivery',
  'reservations',
  'offers',
  'inventory',
  'shifts',
  'activityLog',
];

const LIMITS: Exclude<PlanLimit, 'reportDays'>[] = [
  'staff',
  'branches',
  'floors',
  'tables',
  'dishes',
];

const STATUS_TAG: Record<string, TagVariant> = {
  trial: 'new',
  active: 'ok',
  grace: 'warn',
  expired: 'err',
  suspended: 'out',
};

/**
 * Settings › My plan (the owner's): the restaurant's package, when it ends, what it allows and
 * how much is used, what it includes, and how to reach Restova to upgrade or renew. Read only:
 * the platform changes it.
 */
export function PlanSettings() {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const plan = branch.plan;
  // What this restaurant has, from the platform's catalog (its names, its own extras); what the
  // package leaves out isn't listed.
  const featureList = (
    plan?.features ??
    BUILT_IN.map((key) => ({
      key,
      name: t(`platform.features.names.${key}`),
      description: t(`platform.features.hints.${key}`),
      group: ['ordering', 'takeaway', 'reports'].includes(key) ? 'essentials' : 'advanced',
      included: hasFeature(branch, key),
    }))
  ).filter((f) => f.included);

  return (
    <div className={editor.page}>
      <header className={editor.head}>
        <h1 className={editor.title}>{t('adminSettings.sections.plan.title')}</h1>
        <p className={editor.subtitle}>{t('adminSettings.plan.subtitle')}</p>
      </header>

      {!plan ? (
        <SettingsCard title={t('adminSettings.plan.noneTitle')}>
          <SettingsNote>{t('adminSettings.plan.none')}</SettingsNote>
        </SettingsCard>
      ) : (
        <>
          <SettingsCard
            title={plan.name}
            hint={
              plan.endsAt
                ? t(
                    plan.status === 'trial'
                      ? 'adminSettings.plan.trialEnds'
                      : 'adminSettings.plan.ends',
                    {
                      date: clock.date(new Date(plan.endsAt)),
                    },
                  )
                : t('adminSettings.plan.noEnd')
            }
            action={
              <Tag variant={STATUS_TAG[plan.status] ?? 'plain'}>
                {t(`platform.status.${plan.status}`)}
              </Tag>
            }
          >
            <div className={styles.actions}>
              <PlanContact message={t('adminShell.plan.askRenew', { restaurant: branch.name })} />
            </div>
          </SettingsCard>

          <SettingsCard
            title={t('adminSettings.plan.limitsTitle')}
            hint={t('adminSettings.plan.limitsHint')}
          >
            <ul className={styles.limits}>
              {LIMITS.map((limit) => {
                const max = plan.limits[limit];
                const used = plan.usage[limit];
                const full = max !== null && used >= max;
                return (
                  <li key={limit} className={styles.limit}>
                    <span>{t(`platform.limits.names.${limit}`)}</span>
                    <strong className={cx(full && styles.full)}>
                      {max === null
                        ? t('adminSettings.plan.usedUnlimited', { used })
                        : t('adminSettings.plan.used', { used, max })}
                    </strong>
                  </li>
                );
              })}
              <li className={styles.limit}>
                <span>{t('platform.limits.names.reportDays')}</span>
                <strong>
                  {plan.limits.reportDays === null
                    ? t('platform.limits.unlimited')
                    : t('adminSettings.plan.days', { days: plan.limits.reportDays })}
                </strong>
              </li>
            </ul>
          </SettingsCard>

          <SettingsCard title={t('adminSettings.plan.featuresTitle')}>
            {GROUPS.map((group) => {
              const features = featureList.filter((f) => f.group === group);
              if (!features.length) return null;
              return (
                <div key={group} className={styles.group}>
                  <h3 className={styles.groupTitle}>{t(`platform.features.groups.${group}`)}</h3>
                  <ul className={styles.features}>
                    {features.map((feature) => (
                      <li key={feature.key} className={styles.feature}>
                        <Icon name="check" size="sm" label={t('adminSettings.plan.included')} />
                        <span>
                          <strong>{feature.name}</strong>
                          {feature.description && (
                            <span className={styles.hint}>{feature.description}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </SettingsCard>

          {plan.addons && plan.addons.length > 0 && (
            <SettingsCard title={t('adminSettings.plan.addonsTitle')}>
              <ul className={styles.limits}>
                {plan.addons.map((a, i) => (
                  <li key={`${a.name}-${String(i)}`} className={styles.limit}>
                    <span>{a.name}</span>
                    {a.quantity > 1 && <strong>× {a.quantity}</strong>}
                  </li>
                ))}
              </ul>
            </SettingsCard>
          )}
        </>
      )}
    </div>
  );
}
