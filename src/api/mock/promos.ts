import { itemTotal } from '@/lib/pricing';
import {
  findPromo,
  offerDiscounts,
  promoDiscount,
  promoProblem,
  type OfferLine,
} from '@/lib/promotions';
import type { OrderMode } from '@/types/branch';
import type { Price } from '@/types/menu';
import type { Order } from '@/types/order';
import type { AppliedOffer, PromoCode } from '@/types/promotion';
import { fail } from './context';
import type { OtpRecord } from './db';

/*
 * The server's promo-code rules: who counts as the same guest for a code's per-guest limit, and
 * the checks every quote, payment and order makes before a code takes anything off.
 */

/**
 * The sessions that belong to the guest: every session where their mobile number was verified
 * (a backend keys this on the customer), or just this one before the number is verified.
 */
export function guestSessionIds(otp: Record<string, OtpRecord>, sessionId: string): Set<string> {
  const own = otp[sessionId];
  const ids = new Set([sessionId]);
  if (!own?.verified) return ids;
  for (const [id, record] of Object.entries(otp)) {
    if (record.verified && record.phone === own.phone) ids.add(id);
  }
  return ids;
}

/** How many of these orders (not cancelled) the guest's sessions placed with the code. */
export const promoUses = (
  orders: readonly Pick<Order, 'promoCode' | 'sessionId' | 'status'>[],
  code: string,
  sessionIds: ReadonlySet<string>,
) =>
  orders.filter(
    (o) =>
      o.promoCode === code &&
      o.status !== 'cancelled' &&
      o.sessionId !== undefined &&
      sessionIds.has(o.sessionId),
  ).length;

/** What a code is checked against: the session's mode, when it's priced, and the guest's uses. */
export interface PromoCheck {
  mode: OrderMode;
  at: Date;
  /** How often the guest has used a code already. */
  uses: (code: string) => number;
}

/**
 * The code and what it takes off these lines (after their automatic offers), or 422 with why
 * it can't be used: promo_invalid, promo_expired, promo_mode_not_eligible,
 * promo_limit_reached, below_minimum (`shortBy`).
 */
export function quotePromo(
  codes: readonly PromoCode[],
  code: string,
  lines: readonly (OfferLine & { offer?: AppliedOffer })[],
  check: PromoCheck,
  minorUnit: number,
): { promo: PromoCode; discount: Price; offerDiscount: Price } {
  const promo = findPromo(codes, code);
  const problem = promoProblem(promo, {
    mode: check.mode,
    at: check.at,
    uses: promo ? check.uses(promo.code) : 0,
  });
  if (!promo || problem) fail(422, problem ?? 'promo_invalid');
  const offerMinor = offerDiscounts(lines, minorUnit).reduce((sum, d) => sum + d.amountMinor, 0);
  const { amountMinor, shortBy } = promoDiscount(promo, {
    itemTotalMinor: Math.round(itemTotal(lines) * minorUnit),
    offerMinor,
    minorUnit,
  });
  if (shortBy > 0) fail(422, 'below_minimum', { shortBy });
  return { promo, discount: amountMinor / minorUnit, offerDiscount: offerMinor / minorUnit };
}
