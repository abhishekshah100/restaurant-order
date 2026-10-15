import { useContent } from '@/api/hooks';
import type { AdminServiceRequest } from '@/types/admin';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/**
 * What a request asks for, in the queue's words (adminHome.queue): "Needs water" with the
 * guest's note, or "Wants the bill" with whose orders and the balance.
 */
export function useRequestText() {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  return (request: AdminServiceRequest): { title: string; detail?: string } =>
    request.kind === 'waiter'
      ? {
          title: t(`adminHome.queue.reasons.${request.reason}`),
          detail: request.note ? t('adminHome.queue.note', { note: request.note }) : undefined,
        }
      : {
          title: t('adminHome.queue.bill.title'),
          detail: [
            t(`adminHome.queue.bill.${request.scope}`),
            t('adminHome.queue.bill.balance', { amount: money.format(request.balance) }),
          ].join(' · '),
        };
}
