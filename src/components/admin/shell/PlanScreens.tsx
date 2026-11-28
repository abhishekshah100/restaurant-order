'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { isBackendEnabled } from '@/api/backend';
import { useContent, useFeatures } from '@/api/hooks';
import { refreshAfter } from '@/api/refreshAfter';
import { Banner, Button, EmptyState } from '@/components/ui';
import { settingsPath } from '@/lib/adminNav';
import { SUSPENDING_WARN_DAYS, planNotice, type SuspendWhy } from '@/lib/adminPlan';
import type { BranchPlan } from '@/types/admin';
import { useAdminWorkspace } from './AdminWorkspace';
import { PlanContact } from './PlanContact';
import styles from './PlanScreens.module.css';

const DAY_MS = 86_400_000;
/** setTimeout's longest wait. */
const MAX_WAIT_MS = 2_147_483_647;

/** Why the account is (or will be) paused, in the restaurant's words; null: not said. */
function useWhy() {
  const t = useContent('common');
  return (why: SuspendWhy): string | null =>
    why.notice === 'other'
      ? why.message || null
      : why.notice
        ? t(`adminShell.plan.notices.${why.notice}`)
        : null;
}

/**
 * The time now, moving on when a suspension's warning, start or finish-up end comes (ADR-055):
 * then the banner changes and the branch's plan and permissions are read again.
 */
function usePlanClock(plan: BranchPlan | null | undefined): Date {
  const client = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const startsAt = plan?.suspension?.startsAt;
  const finishUntil = plan?.suspension?.finishUntil;
  useEffect(() => {
    if (!startsAt) return;
    const at = Date.now();
    const starts = Date.parse(startsAt);
    const next = [
      starts - SUSPENDING_WARN_DAYS * DAY_MS,
      starts,
      finishUntil ? Date.parse(finishUntil) : Number.NaN,
    ].filter((mark) => mark > at);
    if (next.length === 0) return;
    const id = window.setTimeout(
      () => {
        setNow(new Date());
        void refreshAfter(client, 'planClock');
      },
      Math.min(Math.min(...next) - at + 1000, MAX_WAIT_MS),
    );
    return () => window.clearTimeout(id);
  }, [startsAt, finishUntil, now, client]);
  return now;
}

/**
 * In place of a page while the plan has ended (management locked; service goes on) or the
 * account is suspended (everything locked), with why where Restova said.
 */
export function PlanEnded() {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const notice = planNotice(branch.plan);
  const why = useWhy();
  const suspended = notice?.kind === 'suspended' || branch.plan?.status === 'suspended';
  if (notice?.kind === 'branchLocked') {
    return (
      <EmptyState
        icon="lock"
        tone="err"
        as="h1"
        title={t('adminShell.plan.branchLockedTitle')}
        actions={
          <div className={styles.actions}>
            <PlanContact message={t('adminShell.plan.askBigger', { restaurant: branch.name })} />
          </div>
        }
      >
        {t('adminShell.plan.branchLockedBody')}
      </EmptyState>
    );
  }
  const reason = notice?.kind === 'suspended' || notice?.kind === 'finishing' ? why(notice) : null;
  return (
    <EmptyState
      icon="lock"
      tone="err"
      as="h1"
      title={t(suspended ? 'adminShell.plan.suspendedTitle' : 'adminShell.plan.endedTitle')}
      actions={
        <div className={styles.actions}>
          <PlanContact
            message={t(suspended ? 'adminShell.plan.askResume' : 'adminShell.plan.askRenew', {
              restaurant: branch.name,
            })}
          />
        </div>
      }
    >
      {suspended
        ? reason
          ? t('adminShell.plan.suspendedBodyWhy', { reason })
          : t('adminShell.plan.suspendedBody')
        : t('adminShell.plan.endedBody')}
    </EmptyState>
  );
}

/**
 * Above every page: the trial or plan ending soon, grace, ended; a suspension coming (from
 * SUSPENDING_WARN_DAYS before), finishing up, or in place, with why. Restova's own staff, who
 * keep everything while a client is suspended, are told they're viewing as Restova.
 */
export function PlanBanner() {
  const t = useContent('common');
  const { branch, clock, can } = useAdminWorkspace();
  const now = usePlanClock(branch.plan);
  const notice = planNotice(branch.plan, now);
  const why = useWhy();
  // Asked only while a suspension is about: is this Restova's own staff?
  const paused = notice?.kind === 'finishing' || notice?.kind === 'suspended';
  const platform = useFeatures(branch.id, isBackendEnabled() && paused).data?.canChange === true;
  if (!notice || !branch.plan) return null;
  const plan = branch.plan.name;

  if (platform && paused) {
    return (
      <div className={styles.banner}>
        <Banner tone="err" icon="shield">
          {t('adminShell.plan.viewingAsRestova')}
        </Banner>
      </div>
    );
  }

  const reason =
    notice.kind === 'suspending' || notice.kind === 'finishing' || notice.kind === 'suspended'
      ? why(notice)
      : null;
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
          : notice.kind === 'suspending'
            ? t('adminShell.plan.suspending', {
                date: clock.dateTime(notice.startsAt),
                reason: reason ?? '',
              })
            : notice.kind === 'finishing'
              ? t('adminShell.plan.finishing', {
                  time: clock.time(notice.until),
                  reason: reason ?? '',
                })
              : notice.kind === 'branchLocked'
                ? t('adminShell.plan.branchLocked')
                : reason
                  ? t('adminShell.plan.suspendedWhy', { reason })
                  : t('adminShell.plan.suspended');
  if (notice.kind === 'changing' || notice.kind === 'locked') {
    // Choosing what to keep is the owner's (Settings › My plan); anyone else asks Restova.
    const parts = (['branches', 'staff', 'tables', 'dishes'] as const).flatMap((k) =>
      notice.kind === 'locked' && notice.counts[k] > 0
        ? [t.plural(`adminShell.plan.lockedParts.${k}`, notice.counts[k])]
        : [],
    );
    return (
      <div className={styles.banner}>
        <Banner
          tone={notice.kind === 'changing' && notice.over ? 'warn' : 'info'}
          icon={notice.kind === 'changing' ? 'calendar' : 'lock'}
          action={
            <span className={styles.actions}>
              {can('branches.manage') && (notice.kind === 'locked' || notice.over) ? (
                <Button size="sm" href={settingsPath('plan')}>
                  {t('adminShell.plan.chooseKeep')}
                </Button>
              ) : (
                <PlanContact
                  size="sm"
                  message={t('adminShell.plan.askBigger', { restaurant: branch.name })}
                />
              )}
            </span>
          }
        >
          {notice.kind === 'changing'
            ? t(notice.over ? 'adminShell.plan.changingOver' : 'adminShell.plan.changing', {
                plan: notice.name,
                date: clock.date(new Date(notice.at)),
              })
            : t('adminShell.plan.locked', { list: parts.join(', ') })}
        </Banner>
      </div>
    );
  }
  const asksResume = notice.kind === 'finishing' || notice.kind === 'suspended';
  return (
    <div className={styles.banner}>
      <Banner
        tone={
          notice.kind === 'ending'
            ? 'info'
            : notice.kind === 'grace' || notice.kind === 'suspending'
              ? 'warn'
              : 'err'
        }
        icon={notice.kind === 'ending' ? 'clock' : 'alert'}
        action={
          <span className={styles.actions}>
            <PlanContact
              size="sm"
              message={t(asksResume ? 'adminShell.plan.askResume' : 'adminShell.plan.askRenew', {
                restaurant: branch.name,
              })}
            />
          </span>
        }
      >
        {text}
      </Banner>
    </div>
  );
}
