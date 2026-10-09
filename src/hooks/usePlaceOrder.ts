'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContent } from '@/api/hooks';
import { useCreateOrder } from '@/api/mutations';
import { useCheckout } from '@/context/CheckoutContext';
import { useGuestSession } from '@/context/GuestSessionContext';
import { useToast } from '@/context/ToastContext';
import { orderLine } from '@/lib/cartLine';
import { orderPath } from '@/lib/orders';
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage';
import type { FulfilmentRequest } from '@/api/contracts';
import type { PaymentMethodId } from '@/types/branch';
import { useCart } from './useCart';
import { useFulfilmentRequest, useOrderBill } from './useFulfilment';
import { useOrderRejected } from './useOrderRejected';

/**
 * Places the order from the current cart (POST /orders) and opens the confirmation. Only
 * called on success — a failed or cancelled payment never touches the cart. An online method
 * passes the succeeded payment's id.
 *
 * Calls are ignored while an order is being placed (a double tap places one order) and when
 * the cart is empty. `placing` stays true until the confirmation page takes over, so a submit
 * button can stay disabled.
 *
 * The cart and checkout session are cleared by the confirmation page (see
 * useFinishPlacedOrder); clearing here would trip the checkout guard's
 * "empty cart → /cart" redirect before navigation completes.
 */
export function usePlaceOrderState(): {
  placeOrder: (method: PaymentMethodId, paymentId?: string) => void;
  placing: boolean;
} {
  const router = useRouter();
  const sessionId = useGuestSession()?.id;
  const { lines, kitchenNote } = useCart();
  const { session } = useCheckout();
  const fulfilment = useFulfilmentRequest();
  const { promoCode } = useOrderBill();
  const { mutateAsync: createOrder } = useCreateOrder();
  const { showToast } = useToast();
  const rejected = useOrderRejected();
  const t = useContent('checkout');
  const inFlight = useRef(false);
  const [placing, setPlacing] = useState(false);

  const place = useCallback(
    async (
      sessionId: string,
      fulfilment: FulfilmentRequest,
      method: PaymentMethodId,
      paymentId?: string,
    ) => {
      try {
        const order = await createOrder({
          sessionId,
          customerName: session.name,
          method,
          kitchenNote,
          lines: lines.map(orderLine),
          fulfilment,
          ...(paymentId ? { paymentId } : {}),
          ...(promoCode ? { promoCode } : {}),
        });
        writeJSON(STORAGE_KEYS.justPlaced, order.id, 'session');
        router.replace(orderPath(order.id, 'confirmed'));
      } catch (error) {
        inFlight.current = false;
        setPlacing(false);
        if (!rejected(error)) showToast(t('payment.placeError'), { tone: 'error' });
      }
    },
    [lines, session.name, kitchenNote, promoCode, createOrder, router, showToast, rejected, t],
  );

  const placeOrder = useCallback(
    (method: PaymentMethodId, paymentId?: string) => {
      if (inFlight.current || lines.length === 0 || !sessionId || !fulfilment) return;
      inFlight.current = true;
      setPlacing(true);
      void place(sessionId, fulfilment, method, paymentId);
    },
    [lines.length, sessionId, fulfilment, place],
  );

  return useMemo(() => ({ placeOrder, placing }), [placeOrder, placing]);
}

const isString = (v: unknown): v is string => typeof v === 'string';

/** On the confirmation page: if this order was just placed here, empty the cart and checkout. */
export function useFinishPlacedOrder(orderId: string | null | undefined) {
  const { clear, hydrated } = useCart();
  const { reset } = useCheckout();
  useEffect(() => {
    if (!hydrated || !orderId) return;
    if (readJSON(STORAGE_KEYS.justPlaced, isString, 'session') !== orderId) return;
    removeKey(STORAGE_KEYS.justPlaced, 'session');
    clear();
    reset();
  }, [hydrated, orderId, clear, reset]);
}
