'use client';

import { isApiError } from '@/api/client';
import type { PlanLimit } from '@/api/contracts/platform';
import { useContent } from '@/api/hooks';
import { SettingsNote } from '../settings/shared/SettingsEditor';
import { useAdminWorkspace } from './AdminWorkspace';
import { PlanContact } from './PlanContact';
import styles from './PlanScreens.module.css';

type CountedLimit = Exclude<PlanLimit, 'reportDays'>;

/**
 * "Staff logins: 4 of 5 on your Basic package" above a list that has a limit; at the limit, in
 * warning colours with a way to ask for more. Nothing without a plan or without a limit.
 * `used`: the count on screen when it isn't saved yet (a floor plan being drawn).
 */
export function PlanLimitNote({ limit, used }: { limit: CountedLimit; used?: number }) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const plan = branch.plan;
  const max = plan?.limits[limit] ?? null;
  if (!plan || max === null) return null;
  const count = used ?? plan.usage[limit];
  const name = t(`platform.limits.names.${limit}`);
  const full = count >= max;
  return (
    <div className={styles.limitNote}>
      <SettingsNote tone={full ? 'warn' : 'info'}>
        {t(full ? 'adminShell.plan.limitFull' : 'adminShell.plan.limitUsed', {
          name,
          used: count,
          max,
          plan: plan.name,
        })}
      </SettingsNote>
      {full && (
        <div className={styles.actions}>
          <PlanContact
            size="sm"
            message={t('adminShell.plan.askMore', { name, restaurant: branch.name })}
          />
        </div>
      )}
    </div>
  );
}

/** Whether one more of a limit fits (no plan or no limit: yes). */
export function usePlanRoom(limit: CountedLimit, used?: number): boolean {
  const plan = useAdminWorkspace().branch.plan;
  const max = plan?.limits[limit] ?? null;
  return !plan || max === null || (used ?? plan.usage[limit]) < max;
}

/** The words for a refusal by the package (403 plan_limit / plan_locked), else undefined. */
export function usePlanRefusal(): (error: unknown) => string | undefined {
  const t = useContent('common');
  return (error) => {
    if (isApiError(error, 'plan_locked')) return t('adminShell.plan.lockedAction');
    if (!isApiError(error, 'plan_limit')) return undefined;
    const { limit, max = 0 } = error.body ?? {};
    if (limit === 'reportDays') return t('adminShell.plan.historyLimit', { days: max });
    return t('adminShell.plan.limitReached', {
      name: limit ? t(`platform.limits.names.${limit}`) : '',
      max,
    });
  };
}
