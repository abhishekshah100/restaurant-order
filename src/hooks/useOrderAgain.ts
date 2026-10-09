'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useContent, useMenu } from '@/api/hooks';
import { useToast } from '@/context/ToastContext';
import { reorderLines } from '@/lib/lifecycle';
import type { Order } from '@/types/order';
import { useCart, useCartActions } from './useCart';

/**
 * "Order again": the order's items go into the cart (same size, choices, add-ons, removals and
 * instructions) for the guest's current branch and mode, at today's menu prices, and the cart
 * opens. Dishes that can't be ordered now are skipped and named in a toast. A cart that was
 * holding an order being changed goes back to its own items first.
 */
export function useOrderAgain() {
  const router = useRouter();
  const menu = useMenu();
  const { editing } = useCart();
  const { addItem, stopEditing } = useCartActions();
  const { showToast } = useToast();
  const t = useContent('orders');

  return useCallback(
    (order: Order) => {
      const { lines, skipped } = reorderLines(order.items, menu);
      if (lines.length === 0) {
        showToast(t('again.noneAvailable'), { tone: 'error' });
        return;
      }
      if (editing) stopEditing();
      for (const { dish, config, quantity } of lines) {
        addItem(dish, config, quantity, { toast: false });
      }
      showToast(
        skipped.length > 0
          ? t('again.skipped', { names: skipped.join(', ') })
          : t('again.added', { id: order.id }),
        skipped.length > 0 ? { tone: 'info' } : undefined,
      );
      router.push('/cart/');
    },
    [menu, editing, stopEditing, addItem, showToast, t, router],
  );
}
