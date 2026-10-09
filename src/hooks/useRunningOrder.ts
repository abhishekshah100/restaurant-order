'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useSessionOrders } from '@/api/hooks';
import { useAddRound } from '@/api/mutations';
import { useGuestSession } from '@/context/GuestSessionContext';
import { useToast } from '@/context/ToastContext';
import { orderLine } from '@/lib/cartLine';
import { openTab } from '@/lib/lifecycle';
import { orderPath } from '@/lib/orders';
import type { PaymentMethodId } from '@/types/branch';
import type { Order } from '@/types/order';
import { useCart } from './useCart';
import { useRequestFailed } from './useRequestFailed';

/**
 * The guest's running dine-in order in this session (GET /sessions/:id/orders): once they've
 * ordered at the table, the cart adds rounds to it instead of checking out again. Null when
 * there's none (or the guest isn't dining in); undefined until their orders have been read.
 */
export function useOpenTab(): Order | null | undefined {
  const session = useGuestSession();
  const dineIn = session?.mode === 'dineIn';
  const { data } = useSessionOrders(dineIn ? session.id : undefined);
  if (session && !dineIn) return null;
  if (!session || !data) return undefined;
  return openTab(data.orders, session.id);
}

/** How a round is paid on a `perRound` branch: the method, and the succeeded payment for an online one. */
export interface RoundPayment {
  method: PaymentMethodId;
  paymentId?: string;
}

/**
 * "Add to my order": the cart goes to the kitchen as the tab's next round (POST
 * /orders/:id/rounds), then the cart empties and tracking opens. On `endOfMeal` branches it
 * goes on the bill; on `perRound` ones it's sent with how it was paid.
 */
export function useAddRoundAction(tab: Order | null | undefined) {
  const router = useRouter();
  const sessionId = useGuestSession()?.id;
  const { lines, kitchenNote, clear } = useCart();
  const { mutateAsync } = useAddRound();
  const { showToast } = useToast();
  const requestFailed = useRequestFailed();
  const t = useContent('cart');
  const inFlight = useRef(false);
  const [adding, setAdding] = useState(false);

  const addRound = useCallback(
    async (payment?: RoundPayment) => {
      if (!tab || !sessionId || lines.length === 0 || inFlight.current) return;
      inFlight.current = true;
      setAdding(true);
      try {
        const order = await mutateAsync({
          orderId: tab.id,
          sessionId,
          lines: lines.map(orderLine),
          kitchenNote,
          ...payment,
        });
        const round = order.rounds?.[order.rounds.length - 1]?.number ?? 1;
        clear();
        showToast(t('tab.added', { round }));
        router.push(orderPath(order.id, 'track'));
      } catch (error) {
        // The order was cancelled meanwhile: the cart checks out as a new order instead.
        if (isApiError(error, 'order_closed')) {
          showToast(t('tab.closed'), { tone: 'error' });
        } else requestFailed();
      } finally {
        inFlight.current = false;
        setAdding(false);
      }
    },
    [tab, sessionId, lines, kitchenNote, mutateAsync, clear, showToast, t, router, requestFailed],
  );

  return { addRound, adding };
}
