'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { useCheckout } from '@/context/CheckoutContext';
import { useOrders } from '@/context/OrdersContext';
import { useToast } from '@/context/ToastContext';
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage';
import type { PaymentMethod } from '@/types/order';
import { useCart } from './useCart';
import { useTable } from './useTable';

/**
 * Places the order from the current cart and opens the confirmation. Only called
 * on success — a failed or cancelled payment never touches the cart.
 *
 * The cart and checkout session are cleared by the confirmation page (see
 * useFinishPlacedOrder); clearing here would trip the checkout guard's
 * "empty cart → /cart" redirect before navigation completes.
 */
export function usePlaceOrder() {
  const router = useRouter();
  const table = useTable();
  const { lines, kitchenNote } = useCart();
  const { session } = useCheckout();
  const { placeOrder } = useOrders();
  const { showToast } = useToast();

  return useCallback(
    (method: PaymentMethod) => {
      const order = placeOrder({
        lines,
        table,
        customerName: session.name,
        method,
        kitchenNote,
      });
      if (!order) {
        showToast("Couldn't place the order on this device. Please ask a waiter.", {
          tone: 'error',
        });
        return;
      }
      writeJSON(STORAGE_KEYS.justPlaced, order.id, 'session');
      router.replace(`/order/${order.id}/confirmed/`);
    },
    [lines, table, session.name, kitchenNote, placeOrder, router, showToast],
  );
}

const isString = (v: unknown): v is string => typeof v === 'string';

/** On the confirmation page: if this order was just placed here, empty the cart and checkout. */
export function useFinishPlacedOrder(orderId: string) {
  const { clear, hydrated } = useCart();
  const { reset } = useCheckout();
  useEffect(() => {
    if (!hydrated) return;
    if (readJSON(STORAGE_KEYS.justPlaced, isString, 'session') !== orderId) return;
    removeKey(STORAGE_KEYS.justPlaced, 'session');
    clear();
    reset();
  }, [hydrated, orderId, clear, reset]);
}
