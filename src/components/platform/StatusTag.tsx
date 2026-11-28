'use client';

import type { ClientSummary, ClientSuspension, PlanStatus } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { Tag, type TagVariant } from '@/components/ui';

const VARIANT: Record<PlanStatus, TagVariant> = {
  trial: 'new',
  active: 'ok',
  grace: 'warn',
  expired: 'err',
  suspended: 'out',
};

/**
 * A client's status as a coloured tag; with a suspension, a second tag: "Suspends 5 Dec" while
 * planned, "Finishing up" while staff finish open bills.
 */
export function StatusTag({
  status,
  suspension,
  planChange,
}: {
  status: PlanStatus;
  suspension?: ClientSuspension | null | undefined;
  /** A package change planned: "Basic from 5 Dec". */
  planChange?: ClientSummary['planChange'] | undefined;
}) {
  const t = useContent('common');
  const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return (
    <>
      <Tag variant={VARIANT[status]}>{t(`platform.status.${status}`)}</Tag>
      {suspension?.planned && (
        <Tag variant="warn">
          {t('platform.suspend.tagPlanned', {
            date: new Date(suspension.startsAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            }),
          })}
        </Tag>
      )}
      {suspension?.finishing && <Tag variant="warn">{t('platform.suspend.tagFinishing')}</Tag>}
      {planChange && (
        <Tag variant="plain">
          {t('platform.downgrade.tagFrom', {
            plan: planChange.name,
            date: shortDate(planChange.at),
          })}
        </Tag>
      )}
    </>
  );
}
