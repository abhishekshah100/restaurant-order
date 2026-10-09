import type { OrderMode } from '@/types/branch';
import type { Dish, Price } from '@/types/menu';
import type { AppliedOffer, AutoOffer, OrderDiscount, PromoCode, Weekday } from '@/types/promotion';
import { itemTotal, percentOf, type BillDiscount } from './pricing';

/*
 * Promotions: automatic offers such as happy hour (dishes in scope cost less on certain days
 * and hours, branch time) and promo codes (a discount off the order). Pure rules: the server
 * applies the same ones (api/mock/promos) and is the authority. Offers come off each item
 * first, then a code comes off what's left; both come off before tax when the branch says so
 * (lib/pricing › calculateBill).
 */

/* ---------- Automatic offers ---------- */

const WEEKDAYS: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const localFormats = new Map<string, Intl.DateTimeFormat>();

/** The weekday and minutes past midnight of `at` in a time zone. */
export function localWeekTime(at: Date, timeZone: string): { day: Weekday; minutes: number } {
  let format = localFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    localFormats.set(timeZone, format);
  }
  const parts = Object.fromEntries(format.formatToParts(at).map((p) => [p.type, p.value]));
  const day = WEEKDAYS.find((d) => d === parts.weekday.slice(0, 3).toLowerCase()) ?? 'sun';
  return { day, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** "16:30" → 990. */
const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const dayBefore = (day: Weekday) => WEEKDAYS[(WEEKDAYS.indexOf(day) + 6) % 7];

/**
 * Whether an offer is on at `at`, in the branch's time zone: on one of its days, from `from`
 * up to (not including) `to`. A window that ends at or before it starts runs past midnight, so
 * it belongs to the day it started on.
 */
export function isOfferActive(
  offer: Pick<AutoOffer, 'days' | 'from' | 'to'>,
  at: Date,
  timeZone: string,
): boolean {
  const { day, minutes } = localWeekTime(at, timeZone);
  const from = toMinutes(offer.from);
  const to = toMinutes(offer.to);
  if (from < to) return offer.days.includes(day) && minutes >= from && minutes < to;
  return (
    (offer.days.includes(day) && minutes >= from) ||
    (offer.days.includes(dayBefore(day)) && minutes < to)
  );
}

/** The offers that are on at `at` (branch time). */
export const activeOffers = (offers: readonly AutoOffer[], at: Date, timeZone: string) =>
  offers.filter((o) => isOfferActive(o, at, timeZone));

/** Whether an offer covers a dish (its category, or the dish itself). */
export const offerCovers = (
  { scope }: Pick<AutoOffer, 'scope'>,
  dish: Pick<Dish, 'slug' | 'categoryId'>,
) => Boolean(scope.dishes?.includes(dish.slug) || scope.categories?.includes(dish.categoryId));

/**
 * What an offer takes off one item at this unit price, in whole major units (menu prices are
 * whole, so discounted prices are too): 20% of ₹199 is ₹40 (half up).
 */
export function offerUnitDiscount(offer: Pick<AutoOffer, 'type' | 'value'>, unitPrice: Price) {
  switch (offer.type) {
    case 'percent':
      return Math.min(unitPrice, Math.round((unitPrice * offer.value) / 100));
    case 'flat':
      return Math.min(unitPrice, offer.value);
    case 'priceOverride':
      return Math.max(0, unitPrice - offer.value);
  }
}

/** The offer that takes the most off a dish at this unit price, or null when none applies. */
export function bestOffer(
  offers: readonly AutoOffer[],
  dish: Pick<Dish, 'slug' | 'categoryId'>,
  unitPrice: Price,
): { offer: AutoOffer; unitDiscount: Price } | null {
  let best: { offer: AutoOffer; unitDiscount: Price } | null = null;
  for (const offer of offers) {
    if (!offerCovers(offer, dish)) continue;
    const unitDiscount = offerUnitDiscount(offer, unitPrice);
    if (unitDiscount > (best?.unitDiscount ?? 0)) best = { offer, unitDiscount };
  }
  return best;
}

/** A line the offers are applied to: its dish, unit price and quantity. */
export interface OfferLine {
  dishSlug: string;
  unitPrice: Price;
  quantity: number;
}

/**
 * The lines with the offer that applies to each (the best one; offers don't add up on one
 * line), replacing any they had. Lines whose dish isn't on the menu, or that no offer covers,
 * have none.
 */
export function applyOffers<L extends OfferLine>(
  lines: readonly L[],
  menu: { getDish(slug: string): Pick<Dish, 'slug' | 'categoryId'> | undefined },
  offers: readonly AutoOffer[],
): (L & { offer?: AppliedOffer })[] {
  return lines.map(({ offer: _previous, ...rest }: L & { offer?: AppliedOffer }) => {
    const line = rest as L;
    const dish = offers.length > 0 ? menu.getDish(line.dishSlug) : undefined;
    const found = dish && bestOffer(offers, dish, line.unitPrice);
    if (!found) return line;
    const { offer, unitDiscount } = found;
    return {
      ...line,
      offer: { id: offer.id, labelKey: offer.labelKey, discount: unitDiscount * line.quantity },
    };
  });
}

/** The offers on some lines as bill discounts (one per offer, in the order they first appear). */
export function offerDiscounts(
  lines: readonly { offer?: AppliedOffer }[],
  minorUnit: number,
): BillDiscount[] {
  const byId = new Map<string, BillDiscount & { kind: 'offer' }>();
  for (const { offer } of lines) {
    if (!offer || offer.discount <= 0) continue;
    const amountMinor = Math.round(offer.discount * minorUnit);
    const seen = byId.get(offer.id);
    if (seen) seen.amountMinor += amountMinor;
    else byId.set(offer.id, { kind: 'offer', id: offer.id, labelKey: offer.labelKey, amountMinor });
  }
  return [...byId.values()];
}

/* ---------- Promo codes ---------- */

/** "  welcome10 " → "WELCOME10". */
export const normaliseCode = (code: string) => code.trim().toUpperCase();

/** The branch's code the guest typed, if there is one. */
export const findPromo = (codes: readonly PromoCode[], code: string | undefined) =>
  code ? codes.find((p) => p.code === normaliseCode(code)) : undefined;

/** Why a code can't be used (besides the minimum order, which depends on the cart). */
export type PromoProblem =
  /** No such code at this branch, or not usable yet. */
  | 'promo_invalid'
  /** Its `validTo` has passed. */
  | 'promo_expired'
  /** Not for this order mode. */
  | 'promo_mode_not_eligible'
  /** The guest has used it `perGuestLimit` times already. */
  | 'promo_limit_reached';

/** Every answer that turns a code down, the cart's minimum (`below_minimum`) included. */
export const PROMO_REFUSALS = [
  'promo_invalid',
  'promo_expired',
  'promo_mode_not_eligible',
  'promo_limit_reached',
  'below_minimum',
] as const satisfies readonly (PromoProblem | 'below_minimum')[];

export type PromoRefusal = (typeof PROMO_REFUSALS)[number];

/** Whether a code can be used now for this mode by a guest who has used it `uses` times. */
export function promoProblem(
  promo: PromoCode | undefined,
  { mode, at, uses }: { mode: OrderMode; at: Date; uses: number },
): PromoProblem | null {
  if (!promo) return 'promo_invalid';
  const time = at.getTime();
  if (promo.validFrom && time < Date.parse(promo.validFrom)) return 'promo_invalid';
  if (promo.validTo && time > Date.parse(promo.validTo)) return 'promo_expired';
  if (!promo.modes.includes(mode)) return 'promo_mode_not_eligible';
  if (promo.perGuestLimit !== undefined && uses >= promo.perGuestLimit) {
    return 'promo_limit_reached';
  }
  return null;
}

/** The codes usable now for a mode (dates and modes): the ones the cart lists to the guest. */
export const availablePromos = (codes: readonly PromoCode[], mode: OrderMode, at: Date) =>
  codes.filter((p) => promoProblem(p, { mode, at, uses: 0 }) === null);

/**
 * What a code takes off, in minor units: a percentage of the items after automatic offers
 * (capped at `maxDiscount`), or a flat amount (never more than those items). Below the code's
 * minimum order (on the item total before discounts) it takes nothing off and says how far
 * the cart is from it.
 */
export function promoDiscount(
  promo: PromoCode,
  {
    itemTotalMinor,
    offerMinor,
    minorUnit,
  }: {
    itemTotalMinor: number;
    offerMinor: number;
    minorUnit: number;
  },
): { amountMinor: number; shortBy: Price } {
  const shortByMinor = Math.max(0, Math.round(promo.minOrder * minorUnit) - itemTotalMinor);
  if (shortByMinor > 0) return { amountMinor: 0, shortBy: shortByMinor / minorUnit };
  const baseMinor = Math.max(0, itemTotalMinor - offerMinor);
  let amountMinor =
    promo.type === 'percent'
      ? percentOf(baseMinor, Math.round(promo.value * 100))
      : Math.round(promo.value * minorUnit);
  if (promo.maxDiscount !== undefined) {
    amountMinor = Math.min(amountMinor, Math.round(promo.maxDiscount * minorUnit));
  }
  return { amountMinor: Math.min(amountMinor, baseMinor), shortBy: 0 };
}

/**
 * Every discount on some lines (or an order's items): their automatic offers, then the code
 * when the lines reach its minimum order.
 */
export function discountsFor(
  lines: readonly (OfferLine & { offer?: AppliedOffer })[],
  promo: PromoCode | undefined,
  minorUnit: number,
): BillDiscount[] {
  const offers = offerDiscounts(lines, minorUnit);
  if (!promo) return offers;
  const { amountMinor } = promoDiscount(promo, {
    itemTotalMinor: Math.round(itemTotal(lines) * minorUnit),
    offerMinor: offers.reduce((sum, d) => sum + d.amountMinor, 0),
    minorUnit,
  });
  return amountMinor > 0 ? [...offers, { kind: 'code', code: promo.code, amountMinor }] : offers;
}

/** A bill's discounts as an order records them (major units). */
export const toOrderDiscounts = (
  discounts: readonly BillDiscount[],
  minorUnit: number,
): OrderDiscount[] =>
  discounts.map(({ amountMinor, ...d }) => ({ ...d, amount: amountMinor / minorUnit }));

/** An order's recorded discounts as bill lines (minor units). */
export const fromOrderDiscounts = (
  discounts: readonly OrderDiscount[] | undefined,
  minorUnit: number,
): BillDiscount[] =>
  (discounts ?? []).map(({ amount, ...d }) => ({
    ...d,
    amountMinor: Math.round(amount * minorUnit),
  }));
