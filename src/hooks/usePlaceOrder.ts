'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContent } from '@/api/hooks';
import { useCheckout } from '@/context/CheckoutContext';
import { useGuestSession } from '@/context/GuestSessionContext';
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
 * Calls are ignored while an order is being placed (a double tap places one
 * order) and when the cart is empty. `placing` stays true until the confirmation
 * page takes over, so a submit button can stay disabled.
 *
 * The cart and checkout session are cleared by the confirmation page (see
 * useFinishPlacedOrder); clearing here would trip the checkout guard's
 * "empty cart → /cart" redirect before navigation completes.
 */
export function usePlaceOrderState(): {
  placeOrder: (method: PaymentMethod) => void;
  placing: boolean;
} {
  const router = useRouter();
  const table = useTable();
  const sessionId = useGuestSession()?.id;
  const { lines, kitchenNote } = useCart();
  const { session } = useCheckout();
  const { placeOrder: place } = useOrders();
  const { showToast } = useToast();
  const t = useContent('checkout');
  const inFlight = useRef(false);
  const [placing, setPlacing] = useState(false);

  const placeOrder = useCallback(
    (method: PaymentMethod) => {
      if (inFlight.current || lines.length === 0 || !sessionId) return;
      inFlight.current = true;
      setPlacing(true);
      const order = place({
        lines,
        table,
        sessionId,
        customerName: session.name,
        method,
        kitchenNote,
      });
      if (!order) {
        inFlight.current = false;
        setPlacing(false);
        showToast(t('payment.placeError'), { tone: 'error' });
        return;
      }
      writeJSON(STORAGE_KEYS.justPlaced, order.id, 'session');
      router.replace(`/order/${order.id}/confirmed/`);
    },
    [lines, table, sessionId, session.name, kitchenNote, place, router, showToast, t],
  );

  return useMemo(() => ({ placeOrder, placing }), [placeOrder, placing]);
}

/** `usePlaceOrderState().placeOrder` on its own. */
export function usePlaceOrder(): (method: PaymentMethod) => void {
  return usePlaceOrderState().placeOrder;
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
