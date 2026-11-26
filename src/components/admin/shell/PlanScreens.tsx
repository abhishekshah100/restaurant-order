'use client';

import { useContent } from '@/api/hooks';
import { Banner, EmptyState } from '@/components/ui';
import { planNotice } from '@/lib/adminPlan';
import { useAdminWorkspace } from './AdminWorkspace';
import { PlanContact } from './PlanContact';
import styles from './PlanScreens.module.css';

/**
 * In place of a page while the plan has ended (management locked; service goes on) or the
 * account is suspended (everything locked).
 */
export function PlanEnded() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const suspended = branch.plan?.status === 'suspended';
  return (
    <EmptyState
      icon="lock"
      tone="err"
      as="h1"
      title={t(suspended ? 'adminShell.plan.suspendedTitle' : 'adminShell.plan.endedTitle')}
      actions={
        <div className={styles.actions}>
          <PlanContact message={t('adminShell.plan.askRenew', { restaurant: branch.name })} />
        </div>
      }
    >
      {t(suspended ? 'adminShell.plan.suspendedBody' : 'adminShell.plan.endedBody')}
    </EmptyState>
  );
}

/** Above every page: the trial or plan ending soon, grace, ended or suspended. */
export function PlanBanner() {
  const t = useContent('common');
  const { branch, clock } = useAdminWorkspace();
  const notice = planNotice(branch.plan);
  if (!notice || !branch.plan) return null;
  const plan = branch.plan.name;
  const text =
    notice.kind === 'ending'
      ? notice.days <= 1
        ? t(notice.trial ? 'adminShell.plan.trialLastDay' : 'adminShell.plan.lastDay', { plan })
        : t(notice.trial ? 'adminShell.plan.trialEnding' : 'adminShell.plan.ending', {
            plan,
            days: notice.days,
          })
      : notice.kind === 'grace'
        ? t('adminShell.plan.grace', { plan, date: clock.date(new Date(notice.lockAt)) })
        : notice.kind === 'expired'
          ? t('adminShell.plan.expired', { plan })
          : t('adminShell.plan.suspended');
  return (
    <div className={styles.banner}>
      <Banner
        tone={notice.kind === 'ending' ? 'info' : notice.kind === 'grace' ? 'warn' : 'err'}
        icon={notice.kind === 'ending' ? 'clock' : 'alert'}
        action={
          <span className={styles.actions}>
            <PlanContact
              size="sm"
              message={t('adminShell.plan.askRenew', { restaurant: branch.name })}
            />
          </span>
        }
      >
        {text}
      </Banner>
    </div>
  );
}
