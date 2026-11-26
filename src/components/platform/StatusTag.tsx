'use client';

import type { PlanStatus } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { Tag, type TagVariant } from '@/components/ui';

const VARIANT: Record<PlanStatus, TagVariant> = {
  trial: 'new',
  active: 'ok',
  grace: 'warn',
  expired: 'err',
  suspended: 'out',
};

/** A client's status as a coloured tag. */
export function StatusTag({ status }: { status: PlanStatus }) {
  const t = useContent('common');
  return <Tag variant={VARIANT[status]}>{t(`platform.status.${status}`)}</Tag>;
}
