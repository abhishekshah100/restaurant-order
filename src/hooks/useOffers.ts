'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useBranch, useMenu, useMenuIfNeeded, usePromotions } from '@/api/hooks';
import { useDishCardShared } from '@/context/DishCardContext';
import { useVisit } from '@/context/GuestSessionContext';
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

const NO_OFFERS: readonly AutoOffer[] = [];

/**
 * The active branch's automatic offers that are on now (branch time) for how the guest is
 * ordering (an offer can be dine-in only); none before hydration. The same list (object) from
 * minute to minute until an offer starts or ends, so what reads it isn't redrawn every minute.
 */
export function useActiveOffers(): readonly AutoOffer[] {
  const { offers } = usePromotions();
  const { timezone } = useBranch();
  const { mode } = useVisit();
  const minute = useMinute();
  const onNow =
    minute === null
      ? ''
      : activeOffers(offers, new Date(minute), timezone, mode)
          .map((offer) => offer.id)
          .join('\n');
  return useMemo(() => {
    if (!onNow) return NO_OFFERS;
    const ids = new Set(onNow.split('\n'));
    return offers.filter((offer) => ids.has(offer.id));
  }, [offers, onNow]);
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
  // The page works out the offers on now once for all its dishes.
  const { offers } = useDishCardShared();
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
  // The menu only when there's something to price: an empty cart (the header on any page)
  // never downloads it.
  const menu = useMenuIfNeeded(lines.length > 0);
  const offers = useActiveOffers();
  const offMinor = useMemo(
    () =>
      menu
        ? offerDiscounts(applyOffers(lines, menu, offers), minorUnit).reduce(
            (n, d) => n + d.amountMinor,
            0,
          )
        : 0,
    [lines, menu, offers, minorUnit],
  );
  return bill.itemTotal - offMinor / minorUnit;
}
