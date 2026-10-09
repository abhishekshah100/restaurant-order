'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useBranch, useMenu, usePromotions } from '@/api/hooks';
import { activeOffers, applyOffers, bestOffer, offerDiscounts } from '@/lib/promotions';
import type { CartLine } from '@/types/cart';
import type { Dish, Price } from '@/types/menu';
import type { AppliedOffer, AutoOffer } from '@/types/promotion';
import { useCart } from './useCart';

const MINUTE_MS = 60_000;

/*
 * One timer for every subscriber, firing on the minute: offers start and end on whole minutes,
 * and a long menu shouldn't start a timer per dish.
 */
const listeners = new Set<() => void>();
let timer: number | undefined;

function tick() {
  timer = window.setTimeout(
    () => {
      listeners.forEach((listener) => listener());
      tick();
    },
    MINUTE_MS - (Date.now() % MINUTE_MS),
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) tick();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.clearTimeout(timer);
  };
}

const currentMinute = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

/**
 * The current minute (epoch ms); null in the prerendered HTML and the first client render, so
 * prices that depend on the time never mismatch on hydration.
 */
export function useMinute(): number | null {
  return useSyncExternalStore(subscribe, currentMinute, () => null);
}

/** The active branch's automatic offers that are on now (branch time); none before hydration. */
export function useActiveOffers(): AutoOffer[] {
  const { offers } = usePromotions();
  const { timezone } = useBranch();
  const minute = useMinute();
  return useMemo(
    () => (minute === null ? [] : activeOffers(offers, new Date(minute), timezone)),
    [offers, timezone, minute],
  );
}

/** A price with an offer on it: what it was and what it is now. */
export interface OfferPrice {
  offer: AutoOffer;
  /** The menu price. */
  was: Price;
  price: Price;
}

/**
 * The offer on a dish now (happy hour) at a unit price (its starting or configured one), and the
 * price with it; null when there's none.
 */
export function useDishOffer(
  dish: Pick<Dish, 'slug' | 'categoryId'>,
  unitPrice: Price,
): OfferPrice | null {
  const offers = useActiveOffers();
  return useMemo(() => {
    const found = bestOffer(offers, dish, unitPrice);
    return found && { offer: found.offer, was: unitPrice, price: unitPrice - found.unitDiscount };
  }, [offers, dish, unitPrice]);
}

/** Cart lines with the offer on each now. */
export function useOfferLines(lines: readonly CartLine[]): (CartLine & { offer?: AppliedOffer })[] {
  const menu = useMenu();
  const offers = useActiveOffers();
  return useMemo(() => applyOffers(lines, menu, offers), [lines, menu, offers]);
}

/** The cart's item total after the offers on now (major units): the cart bar and header button. */
export function useCartItemTotal(): Price {
  const { lines, bill } = useCart();
  const { minorUnit } = useBranch().currency;
  const offerLines = useOfferLines(lines);
  const offMinor = offerDiscounts(offerLines, minorUnit).reduce((n, d) => n + d.amountMinor, 0);
  return bill.itemTotal - offMinor / minorUnit;
}
