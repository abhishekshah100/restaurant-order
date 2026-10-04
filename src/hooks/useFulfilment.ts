'use client';

import { useMemo } from 'react';
import { useBranch, useDeliveryQuote } from '@/api/hooks';
import type { FulfilmentRequest } from '@/api/contracts';
import { useCheckout } from '@/context/CheckoutContext';
import { useVisit } from '@/context/GuestSessionContext';
import { minimumOrder, type DeliveryQuote } from '@/lib/fulfilment';
import { calculateBill, type Bill } from '@/lib/pricing';
import type { OrderMode } from '@/types/branch';
import type { Price } from '@/types/menu';
import { useCart } from './useCart';

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
  /** Ready for checkout: the minimum is met (and, for delivery, the area is quoted). */
  canCheckout: boolean;
}

/**
 * The cart's bill as the guest will pay it for how they order: a delivery adds the fee the
 * server quotes for their area (taxed only if the branch says so) and has the zone's minimum
 * order; takeaway may have a minimum too. Dine-in is the cart's bill as it always was.
 */
export function useOrderBill(): OrderBill {
  const branch = useBranch();
  const { lines, bill: cartBill } = useCart();
  const { mode, deliveryArea } = useVisit();
  const area = mode === 'delivery' ? deliveryArea : undefined;
  const { data: quote, isFetching } = useDeliveryQuote(area, cartBill.itemTotal);
  const current = quote && quote.area === area ? quote : undefined;

  return useMemo(() => {
    const bill =
      mode === 'delivery' && current
        ? calculateBill(lines, branch, {
            fee: current.fee,
            taxable: branch.modes.delivery.feeTaxable,
          })
        : cartBill;
    const minimum = minimumOrder(branch, mode, cartBill.itemTotal, current);
    const quoted = mode !== 'delivery' || current !== undefined;
    return {
      mode,
      bill,
      area,
      quote: current,
      quotePending: area !== undefined && (current === undefined || isFetching),
      minimum,
      canCheckout: quoted && (minimum === null || minimum.shortBy === 0),
    };
  }, [mode, current, lines, branch, cartBill, area, isFetching]);
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
