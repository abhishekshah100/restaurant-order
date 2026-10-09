'use client';

import { useMemo } from 'react';
import { isApiError } from '@/api/client';
import { useBranch, useDeliveryQuote, usePromoQuote } from '@/api/hooks';
import type { FulfilmentRequest, PromoQuote } from '@/api/contracts';
import { useCheckout } from '@/context/CheckoutContext';
import { useGuestSession, useVisit } from '@/context/GuestSessionContext';
import { orderLine } from '@/lib/cartLine';
import { minimumOrder, type DeliveryQuote } from '@/lib/fulfilment';
import { calculateBill, type Bill, type BillDiscount } from '@/lib/pricing';
import { offerDiscounts, PROMO_REFUSALS, type PromoRefusal } from '@/lib/promotions';
import type { OrderMode } from '@/types/branch';
import type { Price } from '@/types/menu';
import { useCart } from './useCart';
import { useOfferLines } from './useOffers';
import { useOpenTab } from './useRunningOrder';

/** Why the cart's promo code takes nothing off: the server's answer. */
export interface PromoError {
  error: PromoRefusal;
  /** below_minimum: how much more the items must add up to. */
  shortBy?: Price;
}

/** The promo code the guest applied to the cart, as the server prices it for the cart now. */
export interface CartPromo {
  /** As applied (the server's spelling once it has answered). */
  code: string;
  /** What it takes off now; undefined while it doesn't apply (or before the first answer). */
  quote: PromoQuote | undefined;
  error: PromoError | undefined;
  /** The cart changed and the server is pricing the code again. */
  pending: boolean;
}

/** The server's "no" to a promo code, if that's what the error is. */
export function promoError(error: unknown): PromoError | undefined {
  for (const refusal of PROMO_REFUSALS) {
    if (isApiError(error, refusal)) return { error: refusal, shortBy: error.body?.shortBy };
  }
  return undefined;
}

export interface OrderBill {
  mode: OrderMode;
  /** The cart's bill, with the delivery fee once the area's quote is in. */
  bill: Bill;
  /** Delivery: the area the guest is ordering to, once chosen. */
  area: string | undefined;
  /** Delivery: the server's quote for the area and item total (POST /delivery/quote). */
  quote: DeliveryQuote | undefined;
  /** Delivery: an area is chosen but its quote hasn't arrived. */
  quotePending: boolean;
  /** The mode's minimum order and how far the cart is from it; null when there's none. */
  minimum: { minimum: Price; shortBy: Price } | null;
  /**
   * The promo code on the cart, while it can apply: a first order (a round on a running order
   * or a change uses the order's own code). Null without one.
   */
  promo: CartPromo | null;
  /** The code that takes something off this cart now: sent with its payment and order. */
  promoCode: string | undefined;
  /** Ready for checkout: the minimum is met (and, for delivery, the area is quoted). */
  canCheckout: boolean;
}

/**
 * The cart's bill as the guest will pay it for how they order: the automatic offers on now
 * (happy hour) and the promo code the server accepts come off first; a delivery adds the fee
 * the server quotes for their area (taxed only if the branch says so) and has the zone's
 * minimum order; takeaway may have a minimum too. Minimums are on the item total before
 * discounts. Without offers or a code, dine-in is the cart's bill as it always was.
 */
export function useOrderBill(): OrderBill {
  const branch = useBranch();
  const sessionId = useGuestSession()?.id;
  const { lines, bill: cartBill, promoCode: applied, editing } = useCart();
  const { mode, deliveryArea } = useVisit();
  const tab = useOpenTab();
  const area = mode === 'delivery' ? deliveryArea : undefined;
  const { data: quote, isFetching } = useDeliveryQuote(area, cartBill.itemTotal);
  const current = quote && quote.area === area ? quote : undefined;
  const offerLines = useOfferLines(lines);
  // A first order only: rounds and changes are priced with the order's own code.
  const code = applied && !editing && tab === null ? applied : undefined;
  const requestLines = useMemo(() => lines.map(orderLine), [lines]);
  const promoQuery = usePromoQuote(sessionId, code, requestLines);

  return useMemo(() => {
    const { minorUnit } = branch.currency;
    const promoQuote = code && !promoQuery.isError ? promoQuery.data : undefined;
    const discounts: BillDiscount[] = offerDiscounts(offerLines, minorUnit);
    if (promoQuote && promoQuote.discount > 0) {
      discounts.push({
        kind: 'code',
        code: promoQuote.code,
        amountMinor: Math.round(promoQuote.discount * minorUnit),
      });
    }
    const delivery =
      mode === 'delivery' && current
        ? { fee: current.fee, taxable: branch.modes.delivery.feeTaxable }
        : undefined;
    const bill =
      delivery || discounts.length > 0
        ? calculateBill(lines, branch, delivery, discounts)
        : cartBill;
    const minimum = minimumOrder(branch, mode, cartBill.itemTotal, current);
    const quoted = mode !== 'delivery' || current !== undefined;
    const promo: CartPromo | null = code
      ? {
          code: promoQuote?.code ?? code,
          quote: promoQuote,
          error: promoQuery.isError ? promoError(promoQuery.error) : undefined,
          pending: promoQuery.isFetching,
        }
      : null;
    return {
      mode,
      bill,
      area,
      quote: current,
      quotePending: area !== undefined && (current === undefined || isFetching),
      minimum,
      promo,
      promoCode: promoQuote?.code,
      canCheckout: quoted && (minimum === null || minimum.shortBy === 0) && !promo?.pending,
    };
  }, [
    mode,
    current,
    lines,
    offerLines,
    branch,
    cartBill,
    area,
    isFetching,
    code,
    promoQuery.data,
    promoQuery.error,
    promoQuery.isError,
    promoQuery.isFetching,
  ]);
}

/** How the order reaches the guest, for POST /payments and POST /orders; null until it's chosen. */
export function useFulfilmentRequest(): FulfilmentRequest | null {
  const { mode } = useVisit();
  const { pickupAt, address } = useCheckout().session;
  return useMemo(() => {
    if (mode === 'takeaway') return { mode, pickupAt };
    if (mode === 'delivery') return address ? { mode, address } : null;
    return { mode };
  }, [mode, pickupAt, address]);
}
