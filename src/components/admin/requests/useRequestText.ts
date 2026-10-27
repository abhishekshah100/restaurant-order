import { useContent } from '@/api/hooks';
import type { Translator } from '@/api/translator';
import type { ContentMap } from '@/api/queries';
import type { AdminServiceRequest } from '@/types/admin';
import type { KitchenMessage } from '@/types/service';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/**
 * What a request asks for, in the queue's words (adminHome.queue): "Needs water" with the
 * guest's note, "Wants the bill" with whose orders and the balance, or the kitchen's message
 * about an order ("Kitchen · order UDY-012", "An item isn't available · “Out of paneer”").
 */
export function useRequestText() {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  return (request: AdminServiceRequest): { title: string; detail?: string } =>
    request.kind === 'kitchen'
      ? kitchenText(t, request)
      : request.kind === 'waiter'
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

/** The kitchen's message: which order, why, what it added, and who sent it. */
export function kitchenText(
  t: Translator<ContentMap['common']>,
  request: KitchenMessage,
): { title: string; detail?: string } {
  return {
    title: t('adminHome.queue.kitchen.title', { order: request.orderId }),
    detail: [
      t(`adminHome.queue.kitchen.reasons.${request.reason}`),
      request.note ? t('adminHome.queue.note', { note: request.note }) : null,
      request.sentBy ? t('adminHome.queue.kitchen.from', { name: request.sentBy }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}
