'use client';

import { useContent } from '@/api/hooks';
import { Banner } from '@/components/ui';
import type { Order } from '@/types/order';

/**
 * Tells the guest what the kitchen couldn't make (sold out): the dishes, that they're off the
 * bill, and that anything paid online for them goes back. Nothing when everything's coming.
 */
export function UnavailableNotice({ order, className }: { order: Order; className?: string }) {
  const t = useContent('orders');
  const names = [...new Set(order.items.filter((i) => i.unavailable).map((i) => i.name))];
  if (names.length === 0 || order.status === 'cancelled') return null;
  const dishes =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')}${t('unavailable.and')}${names.at(-1)}`;
  return (
    <Banner tone="warn" icon="alert" className={className}>
      {names.length === 1
        ? t('unavailable.notice', { dishes })
        : t('unavailable.noticeMany', { dishes })}{' '}
      {order.payment.method === 'online' && t('unavailable.refund')}
    </Banner>
  );
}
