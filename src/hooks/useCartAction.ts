'use client';

import { useState } from 'react';
import { useBranch, useOrder, usePromotions } from '@/api/hooks';
import { calculateBill } from '@/lib/pricing';
import { discountsFor, findPromo } from '@/lib/promotions';
import type { PaymentMethodId } from '@/types/branch';
import type { Order } from '@/types/order';
import { useCart } from './useCart';
import { useOrderBill } from './useFulfilment';
import { useOfferLines } from './useOffers';
import { useChangeWindow, useUpdateOrder, type ChangeWindowView } from './useOrderChanges';
import { useAddRoundAction, useOpenTab } from './useRunningOrder';

/** What needs paying before the cart goes to the kitchen. */
export interface PaymentPrompt {
  /** A round on a `perRound` branch, or the difference after changing an order paid online. */
  purpose: 'round' | 'change';
  order: Order;
  /** The round being added or changed. */
  round: number;
  /** What the server asks for (a change), or the round's share of the tab (shown before paying). */
  amount: number;
}

/** How it was paid: an online payment that succeeded, or an in-person method (a round at the counter). */
export interface PaidWith {
  method: PaymentMethodId;
  paymentId?: string;
}

/** The payment step the cart's action may need, for OrderPaymentDialog. */
export interface CartPayment {
  prompt: PaymentPrompt | null;
  /** The round or change is being sent: keep the buttons disabled. */
  busy: boolean;
  onPaid: (paid: PaidWith) => void;
  onClose: () => void;
}

/** What the cart's primary button does. */
export type CartAction =
  /** A first order: on to checkout. */
  | { kind: 'checkout'; disabled: boolean }
  /** The guest has a running dine-in order: the cart goes on it as the next round. */
  | {
      kind: 'addRound';
      tab: Order;
      round: number;
      disabled: boolean;
      busy: boolean;
      run: () => void;
    }
  /** The cart holds an order being changed: it replaces the order's latest round. */
  | {
      kind: 'update';
      orderId: string;
      round: number;
      /** The order being changed, once read, and its change window. */
      order: Order | undefined;
      window: ChangeWindowView | null;
      disabled: boolean;
      busy: boolean;
      run: () => void;
    };

/**
 * The cart's primary action — Checkout, "Add to my order" (a running dine-in order) or "Update
 * order" (editing) — and the payment it may need first: a round on a `perRound` branch, or the
 * difference when an order paid online now costs more.
 */
export function useCartAction(): { action: CartAction; payment: CartPayment } {
  const branch = useBranch();
  const { lines, editing } = useCart();
  const { canCheckout } = useOrderBill();
  const { codes } = usePromotions();
  const offerLines = useOfferLines(lines);
  const tab = useOpenTab();
  const { data: edited } = useOrder(editing?.orderId);
  const changes = useChangeWindow(edited);
  const { addRound, adding } = useAddRoundAction(tab);
  const { update, updating } = useUpdateOrder();
  const [prompt, setPrompt] = useState<PaymentPrompt | null>(null);
  const empty = lines.length === 0;

  const payment: CartPayment = {
    prompt,
    busy: adding || updating,
    onClose: () => setPrompt(null),
    onPaid: async ({ method, paymentId }: PaidWith) => {
      if (prompt?.purpose === 'round') await addRound({ method, paymentId });
      else if ((await update(paymentId))?.status !== 'pay') setPrompt(null);
    },
  };

  if (editing) {
    // Until the order is read the window is unknown; the server decides in the end anyway.
    const open = edited === undefined || changes?.open === true;
    return {
      action: {
        kind: 'update',
        orderId: editing.orderId,
        round: editing.round,
        order: edited,
        window: changes,
        disabled: empty || !canCheckout || !open,
        busy: updating,
        run: async () => {
          const result = await update();
          if (result?.status === 'pay' && edited) {
            setPrompt({
              purpose: 'change',
              order: edited,
              round: editing.round,
              amount: result.amount,
            });
          }
        },
      },
      payment,
    };
  }

  if (tab && !empty) {
    const round = (tab.rounds?.length ?? 1) + 1;
    return {
      action: {
        kind: 'addRound',
        tab,
        round,
        disabled: false,
        busy: adding,
        run: () => {
          if (branch.ordering.dineInPayment === 'endOfMeal') {
            void addRound();
            return;
          }
          // The round's share of the tab, as the server will work it out (taxes and the tab's
          // promo code on the whole tab, the offers on now on the round).
          const items = [...tab.items, ...offerLines];
          const promo = findPromo(codes, tab.promoCode);
          const discounts = discountsFor(items, promo, branch.currency.minorUnit);
          const share = calculateBill(items, branch, undefined, discounts).total - tab.total;
          setPrompt({ purpose: 'round', order: tab, round, amount: share });
        },
      },
      payment,
    };
  }

  return { action: { kind: 'checkout', disabled: !canCheckout }, payment };
}
