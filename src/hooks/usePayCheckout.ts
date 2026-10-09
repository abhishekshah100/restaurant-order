'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useCreatePayment, useSimulatePayment } from '@/api/mutations';
import { useCheckout } from '@/context/CheckoutContext';
import { useGuestSession } from '@/context/GuestSessionContext';
import { orderLine } from '@/lib/cartLine';
import type { PaymentMethodId } from '@/types/branch';
import { useCart } from './useCart';
import { useFulfilmentRequest, useOrderBill } from './useFulfilment';
import { useOrderRejected } from './useOrderRejected';
import { usePlaceOrderState } from './usePlaceOrder';
import { useRequestFailed } from './useRequestFailed';

interface PayCheckout {
  /** Opens a payment request for the cart (POST /payments); false if none could be opened. */
  start: (method: PaymentMethodId) => Promise<boolean>;
  /** Prototype "success": the partner confirms the payment, then the order is placed with it. */
  succeed: () => void;
  /** Prototype "failure": the partner reports the payment failed. */
  fail: () => void;
  /** Places an order paid at the counter (no payment request). */
  placeOrder: (method: PaymentMethodId) => void;
  /** True while the payment is being confirmed or the order placed: keep the buttons disabled. */
  placing: boolean;
}

/** Paying for the cart online at checkout: the payment request, its (mock) result and the order. */
export function usePayCheckout(): PayCheckout {
  const sessionId = useGuestSession()?.id;
  const { lines } = useCart();
  const { session, setPayment } = useCheckout();
  const fulfilment = useFulfilmentRequest();
  const { promoCode } = useOrderBill();
  const { placeOrder, placing } = usePlaceOrderState();
  const { mutateAsync: createPayment } = useCreatePayment();
  const { mutateAsync: simulate, mutate: report, isPending: settling } = useSimulatePayment();
  const requestFailed = useRequestFailed();
  const rejected = useOrderRejected();
  const opening = useRef(false);
  const payment = session.payment;

  const start = useCallback(
    async (method: PaymentMethodId) => {
      if (!sessionId || !fulfilment || opening.current) return false;
      opening.current = true;
      try {
        const opened = await createPayment({
          purpose: 'order',
          sessionId,
          method,
          lines: lines.map(orderLine),
          fulfilment,
          ...(promoCode ? { promoCode } : {}),
        });
        setPayment(opened);
        return true;
      } catch (error) {
        if (!rejected(error)) requestFailed();
        return false;
      } finally {
        opening.current = false;
      }
    },
    [sessionId, fulfilment, lines, promoCode, createPayment, setPayment, requestFailed, rejected],
  );

  const succeed = useCallback(async () => {
    if (!payment || settling || placing) return;
    try {
      const settled = await simulate({ id: payment.id, outcome: 'succeeded' });
      placeOrder(settled.payment.method, settled.payment.id);
    } catch {
      requestFailed();
    }
  }, [payment, settling, placing, simulate, placeOrder, requestFailed]);

  // The failure screen shows straight away; the server is told in the background.
  const fail = useCallback(() => {
    if (payment) report({ id: payment.id, outcome: 'failed' });
  }, [payment, report]);

  return useMemo(
    () => ({
      start,
      succeed: () => void succeed(),
      fail,
      placeOrder,
      placing: placing || settling,
    }),
    [start, succeed, fail, placeOrder, placing, settling],
  );
}
