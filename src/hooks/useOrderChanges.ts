'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { isApiError } from '@/api/client';
import { useContent, useMenu, useRegion } from '@/api/hooks';
import { useCancelOrder, useChangeOrder } from '@/api/mutations';
import { useGuestSession } from '@/context/GuestSessionContext';
import { useToast } from '@/context/ToastContext';
import { orderLine } from '@/lib/cartLine';
import {
  activeRounds,
  changeWindow,
  latestRound,
  reorderLines,
  type ChangeWindow,
} from '@/lib/lifecycle';
import { isOwnOrder, orderPath } from '@/lib/orders';
import type { Order } from '@/types/order';
import { useCart, useCartActions } from './useCart';
import { useCountdown } from './useCountdown';
import { useOrderRejected } from './useOrderRejected';
import { useRequestFailed } from './useRequestFailed';

/** The change window of one of the guest's own orders, ticking down once a second. */
export type ChangeWindowView = ChangeWindow & {
  /** Seconds left while open. */
  secondsLeft: number;
  /** A running order with more than one round: the window is the latest round's. */
  isTab: boolean;
};

/**
 * Whether the guest can still change or cancel their order's latest round, with a live
 * countdown; null for other guests' orders, orders that never could be changed, and before
 * the first client render. The server is the authority: it refuses once the window has closed.
 */
export function useChangeWindow(order: Order | undefined): ChangeWindowView | null {
  const sessionId = useGuestSession()?.id;
  const round = order && latestRound(order);
  const closesAt = round ? Date.parse(round.changeableUntil) : null;
  const secondsLeft = useCountdown(closesAt);
  if (!order || closesAt === null || secondsLeft === null || !isOwnOrder(order, sessionId)) {
    return null;
  }
  // The countdown's clock: when it reaches 0 the window is over.
  const window = changeWindow(order, closesAt - secondsLeft * 1000);
  return window && { ...window, secondsLeft, isTab: activeRounds(order).length > 1 };
}

/** The account a refund goes back to: the order's online method ("UPI"), or the generic name. */
function useRefundMethod() {
  const common = useContent('common');
  return useCallback(
    (order: Order) => order.payment.detail ?? common('paymentMethods.online'),
    [common],
  );
}

/**
 * Cancelling the order's latest round within the window (POST /orders/:id/cancel). A whole
 * order shows its cancelled state; a later round says so in a toast, with any refund.
 */
export function useCancelOrderAction(order: Order) {
  const sessionId = useGuestSession()?.id;
  const { mutateAsync, isPending } = useCancelOrder();
  const { showToast } = useToast();
  const requestFailed = useRequestFailed();
  const refundMethod = useRefundMethod();
  const { money } = useRegion();
  const t = useContent('orders');

  const cancel = useCallback(
    async (round: number): Promise<boolean> => {
      if (!sessionId) return false;
      try {
        const { order: next, refunded } = await mutateAsync({
          orderId: order.id,
          sessionId,
          round,
        });
        if (next.status !== 'cancelled') {
          showToast(
            refunded > 0
              ? t('cancelled.roundRefund', {
                  round,
                  amount: money.format(refunded),
                  method: refundMethod(next),
                })
              : t('cancelled.roundCancelled', { round }),
          );
        }
        return true;
      } catch (error) {
        if (isApiError(error, 'window_closed')) {
          showToast(t('change.tooLate'), { tone: 'error' });
        } else requestFailed();
        return false;
      }
    },
    [sessionId, mutateAsync, order.id, showToast, t, money, refundMethod, requestFailed],
  );

  return { cancel, cancelling: isPending };
}

/** "Change order": the latest round's items go into the cart in editing mode, then the cart opens. */
export function useEditOrder() {
  const router = useRouter();
  const menu = useMenu();
  const { startEditing } = useCartActions();
  return useCallback(
    (order: Order) => {
      const round = latestRound(order);
      if (!round) return;
      const { lines } = reorderLines(round.items, menu);
      startEditing({ orderId: order.id, round: round.number }, lines, round.kitchenNote ?? '');
      router.push('/cart/');
    },
    [menu, startEditing, router],
  );
}

/** What updating the order came to: done, a difference to pay first, or nothing (an error was shown). */
export type UpdateResult = { status: 'updated' } | { status: 'pay'; amount: number } | null;

/**
 * "Update order" in editing mode (PATCH /orders/:id): the cart's items replace the round's.
 * On success the cart goes back to what it held before and tracking opens; an order paid online
 * that now costs more answers with the difference to pay first (`pay`).
 */
export function useUpdateOrder() {
  const router = useRouter();
  const sessionId = useGuestSession()?.id;
  const { lines, kitchenNote, editing } = useCart();
  const { stopEditing } = useCartActions();
  const { mutateAsync } = useChangeOrder();
  const { showToast } = useToast();
  const requestFailed = useRequestFailed();
  const rejected = useOrderRejected();
  const refundMethod = useRefundMethod();
  const { money } = useRegion();
  const t = useContent('cart');
  const orders = useContent('orders');
  const inFlight = useRef(false);
  const [updating, setUpdating] = useState(false);

  const update = useCallback(
    async (paymentId?: string): Promise<UpdateResult> => {
      if (!editing || !sessionId || lines.length === 0 || inFlight.current) return null;
      inFlight.current = true;
      setUpdating(true);
      try {
        const { order, refunded } = await mutateAsync({
          orderId: editing.orderId,
          sessionId,
          round: editing.round,
          lines: lines.map(orderLine),
          kitchenNote,
          ...(paymentId ? { paymentId } : {}),
        });
        stopEditing();
        showToast(
          refunded > 0
            ? t('editing.refund', {
                id: order.id,
                amount: money.format(refunded),
                method: refundMethod(order),
              })
            : t('editing.updated', { id: order.id }),
        );
        router.push(orderPath(order.id, 'track'));
        return { status: 'updated' };
      } catch (error) {
        if (isApiError(error, 'payment_required')) {
          return { status: 'pay', amount: error.body?.amountDue ?? 0 };
        }
        if (isApiError(error, 'window_closed')) {
          showToast(orders('change.tooLate'), { tone: 'error' });
        } else if (!rejected(error)) requestFailed();
        return null;
      } finally {
        inFlight.current = false;
        setUpdating(false);
      }
    },
    [
      editing,
      sessionId,
      lines,
      kitchenNote,
      mutateAsync,
      stopEditing,
      showToast,
      t,
      orders,
      money,
      refundMethod,
      router,
      rejected,
      requestFailed,
    ],
  );

  return { update, updating };
}
