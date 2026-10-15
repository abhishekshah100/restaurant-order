'use client';

import { useMemo } from 'react';
import { useContent } from '@/api/hooks';
import type { IconName } from '@/components/ui';
import { minutesSince } from '@/lib/adminService';
import { PAYMENT_METHODS, isPaymentMethodId } from '@/lib/payments';
import type { Price } from '@/types/menu';
import type { Order } from '@/types/order';
import { useAdminWorkspace } from '../shell/AdminWorkspace';

/** How a method is drawn: cash is cash; the rest as the app knows them (a card for the unknown). */
export const methodIcon = (method: string): IconName =>
  method === 'cash' ? 'cash' : isPaymentMethodId(method) ? PAYMENT_METHODS[method].icon : 'card';

/**
 * The words the Payments page builds from data: amounts, a method's name ("Cash", "eSewa"), where an
 * order is ("Table 12", "Takeaway"), and how long ago something happened ("4 min ago").
 */
export function usePaymentText() {
  const t = useContent('common');
  const { money } = useAdminWorkspace();
  return useMemo(() => {
    const names: Record<string, string> = t.get('paymentMethods');
    return {
      /** "₹525", or "₹262.50" when there are paise (a split share, a tip). */
      amount: (value: Price) =>
        Number.isInteger(value) ? money.format(value) : money.formatMinor(money.toMinor(value)),
      methodName: (method: string) => names[method] ?? method,
      where: (order: Pick<Order, 'mode' | 'table'>) =>
        order.mode === 'dineIn' && order.table !== undefined
          ? t('adminHome.queue.where.table', { table: order.table })
          : t(`modes.${order.mode}`),
      ago: (iso: string, now: Date) => {
        const minutes = minutesSince(iso, now);
        if (minutes < 1) return t('adminHome.queue.age.now');
        if (minutes < 60) return t('adminHome.queue.age.minutes', { count: minutes });
        return t('adminHome.queue.age.hours', {
          hours: Math.floor(minutes / 60),
          minutes: minutes % 60,
        });
      },
    };
  }, [t, money]);
}
