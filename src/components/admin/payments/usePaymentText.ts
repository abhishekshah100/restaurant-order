'use client';

import { useMemo } from 'react';
import { useContent } from '@/api/hooks';
import type { IconName } from '@/components/ui';
import { minutesSince } from '@/lib/adminService';
import type { Money } from '@/lib/money';
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
  return usePaymentWords(useAdminWorkspace().money);
}

/** The same words for any branch's money: the guest's printed invoice uses them too. */
export function usePaymentWords(money: Money) {
  const t = useContent('common');
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

/**
 * Each method's name as a list shows it: its name ("Cash", "UPI"), with how it was paid when two
 * methods share a name ("UPI · In person", "UPI · Online"), so no two read the same.
 */
export function useMethodLabels(
  methods: readonly { method: string; channel: 'online' | 'inPerson' }[],
): (method: string) => string {
  const t = useContent('common');
  const { methodName } = usePaymentText();
  return useMemo(() => {
    const named = methods.map((m) => ({ ...m, name: methodName(m.method) }));
    const labels = new Map(
      named.map((m) => [
        m.method,
        named.some((o) => o.method !== m.method && o.name === m.name)
          ? t('adminPayments.methodWithChannel', {
              method: m.name,
              channel: t(`adminPayments.channels.${m.channel}`),
            })
          : m.name,
      ]),
    );
    return (method: string) => labels.get(method) ?? methodName(method);
  }, [methods, methodName, t]);
}
