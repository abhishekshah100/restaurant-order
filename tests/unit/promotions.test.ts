import { describe, expect, it } from 'vitest';
import { orderBill } from '@/lib/orders';
import { calculateBill, extrasMinor, type Bill, type BillDiscount } from '@/lib/pricing';
import {
  activeOffers,
  applyOffers,
  availablePromos,
  bestOffer,
  discountsFor,
  findPromo,
  fromOrderDiscounts,
  isOfferActive,
  localWeekTime,
  offerDiscounts,
  offerUnitDiscount,
  promoDiscount,
  promoProblem,
  toOrderDiscounts,
} from '@/lib/promotions';
import type { AutoOffer, PromoCode } from '@/types/promotion';
import { testBranch, testMenu, testPromotions } from '../apiState';

const india = testBranch();
const nepal = testBranch('ktm-thamel');
const indiaPromos = testPromotions();
const nepalPromos = testPromotions('ktm-thamel');
const [happyHour] = indiaPromos.offers;
const KOLKATA = india.timezone;
const KATHMANDU = nepal.timezone;

const welcome10 = findPromo(indiaPromos.codes, 'WELCOME10') as PromoCode;
const flat50 = findPromo(indiaPromos.codes, 'FLAT50') as PromoCode;
const namaste15 = findPromo(nepalPromos.codes, 'NAMASTE15') as PromoCode;

const at = (iso: string) => new Date(iso);

/** A bill line's amount by id, including split parts (CGST, SGST). */
function amount(bill: Bill, id: string): number | undefined {
  const all = bill.lines.flatMap((l) => [l, ...(l.parts ?? [])]);
  return all.find((l) => l.id === id)?.amountMinor;
}

const code = (promo: PromoCode, amountMinor: number): BillDiscount => ({
  kind: 'code',
  code: promo.code,
  amountMinor,
});

describe('promotions data', () => {
  it('India: WELCOME10 (10%, up to ₹100, from ₹299, every mode, once) and FLAT50 (delivery, from ₹499)', () => {
    expect(welcome10).toMatchObject({
      type: 'percent',
      value: 10,
      maxDiscount: 100,
      minOrder: 299,
      modes: ['dineIn', 'takeaway', 'delivery'],
      perGuestLimit: 1,
    });
    expect(flat50).toMatchObject({ type: 'flat', value: 50, minOrder: 499, modes: ['delivery'] });
  });

  it('Nepal: NAMASTE15 (15%, up to रू 250); both: happy hour 16:00–19:00, 20% off Beverages', () => {
    expect(namaste15).toMatchObject({ type: 'percent', value: 15, maxDiscount: 250 });
    for (const promos of [indiaPromos, nepalPromos]) {
      expect(promos.offers).toEqual([
        expect.objectContaining({
          id: 'happy-hour',
          from: '16:00',
          to: '19:00',
          scope: { categories: ['beverages'] },
          type: 'percent',
          value: 20,
        }),
      ]);
      expect(promos.offers[0].days).toHaveLength(7);
    }
  });

  it('both branches take discounts off before tax', () => {
    expect(india.tax.discountBeforeTax).toBe(true);
    expect(nepal.tax.discountBeforeTax).toBe(true);
  });
});

describe('happy-hour window in the branch time zone', () => {
  it('Kolkata (+5:30): 16:00 to 18:59 IST', () => {
    expect(isOfferActive(happyHour, at('2026-10-08T10:29:00Z'), KOLKATA)).toBe(false); // 3:59 PM
    expect(isOfferActive(happyHour, at('2026-10-08T10:30:00Z'), KOLKATA)).toBe(true); // 4:00 PM
    expect(isOfferActive(happyHour, at('2026-10-08T13:29:59Z'), KOLKATA)).toBe(true); // 6:59 PM
    expect(isOfferActive(happyHour, at('2026-10-08T13:30:00Z'), KOLKATA)).toBe(false); // 7:00 PM
  });

  it('Kathmandu (+5:45): a quarter of an hour earlier in UTC', () => {
    expect(isOfferActive(happyHour, at('2026-10-08T10:14:00Z'), KATHMANDU)).toBe(false); // 3:59 PM
    expect(isOfferActive(happyHour, at('2026-10-08T10:15:00Z'), KATHMANDU)).toBe(true); // 4:00 PM
    expect(isOfferActive(happyHour, at('2026-10-08T13:14:00Z'), KATHMANDU)).toBe(true); // 6:59 PM
    expect(isOfferActive(happyHour, at('2026-10-08T13:15:00Z'), KATHMANDU)).toBe(false); // 7:00 PM
    // 10:20Z is 3:50 PM in Bengaluru but 4:05 PM in Kathmandu.
    const instant = at('2026-10-08T10:20:00Z');
    expect(activeOffers(indiaPromos.offers, instant, KOLKATA)).toEqual([]);
    expect(activeOffers(nepalPromos.offers, instant, KATHMANDU)).toHaveLength(1);
  });

  it('reads the weekday in the branch time zone, not UTC', () => {
    // Friday 18:20 UTC is Friday 11:50 PM in Bengaluru, Saturday 12:05 AM in Kathmandu.
    const instant = at('2026-10-02T18:20:00Z');
    expect(localWeekTime(instant, KOLKATA)).toEqual({ day: 'fri', minutes: 23 * 60 + 50 });
    expect(localWeekTime(instant, KATHMANDU)).toEqual({ day: 'sat', minutes: 5 });
    const saturdayMorning = { days: ['sat' as const], from: '00:00', to: '01:00' };
    expect(isOfferActive(saturdayMorning, instant, KOLKATA)).toBe(false);
    expect(isOfferActive(saturdayMorning, instant, KATHMANDU)).toBe(true);
  });

  it('only on its days; a window past midnight belongs to the day it starts', () => {
    const lateFriday = { days: ['fri' as const], from: '22:00', to: '02:00' };
    // 2 Oct 2026 is a Friday (Kathmandu time below).
    expect(isOfferActive(lateFriday, at('2026-10-02T17:45:00+05:45'), KATHMANDU)).toBe(false);
    expect(isOfferActive(lateFriday, at('2026-10-02T23:30:00+05:45'), KATHMANDU)).toBe(true);
    expect(isOfferActive(lateFriday, at('2026-10-03T01:30:00+05:45'), KATHMANDU)).toBe(true);
    expect(isOfferActive(lateFriday, at('2026-10-03T02:00:00+05:45'), KATHMANDU)).toBe(false);
    // Early Friday is still Thursday's night.
    expect(isOfferActive(lateFriday, at('2026-10-02T01:30:00+05:45'), KATHMANDU)).toBe(false);
    expect(isOfferActive(lateFriday, at('2026-10-03T23:30:00+05:45'), KATHMANDU)).toBe(false);
    const weekdays = { ...happyHour, days: ['mon' as const] };
    // Thursday 8 Oct, 5 PM: not a Monday.
    expect(isOfferActive(weekdays, at('2026-10-08T17:00:00+05:30'), KOLKATA)).toBe(false);
  });
});

describe('offer prices', () => {
  const menu = testMenu();
  const dish = (slug: string) => menu.getDish(slug)!;

  it('20% off rounds each item to a whole rupee, half up', () => {
    expect(offerUnitDiscount(happyHour, 199)).toBe(40); // 39.8
    expect(offerUnitDiscount(happyHour, 179)).toBe(36); // 35.8
    expect(offerUnitDiscount(happyHour, 99)).toBe(20); // 19.8
    expect(offerUnitDiscount(happyHour, 320)).toBe(64);
  });

  it('flat and price-override offers, never below zero', () => {
    expect(offerUnitDiscount({ type: 'flat', value: 50 }, 129)).toBe(50);
    expect(offerUnitDiscount({ type: 'flat', value: 50 }, 49)).toBe(49);
    expect(offerUnitDiscount({ type: 'priceOverride', value: 99 }, 179)).toBe(80);
    expect(offerUnitDiscount({ type: 'priceOverride', value: 99 }, 49)).toBe(0);
  });

  it('covers its categories and dishes only, and the best offer wins', () => {
    expect(bestOffer([happyHour], dish('cold-coffee'), 179)).toMatchObject({ unitDiscount: 36 });
    expect(bestOffer([happyHour], dish('dal-makhani'), 299)).toBeNull();
    const naanDeal: AutoOffer = {
      ...happyHour,
      id: 'naan',
      scope: { dishes: ['garlic-naan', 'cold-coffee'] },
      type: 'flat',
      value: 10,
    };
    expect(bestOffer([naanDeal], dish('garlic-naan'), 89)).toMatchObject({ unitDiscount: 10 });
    expect(bestOffer([naanDeal, happyHour], dish('cold-coffee'), 179)?.offer.id).toBe('happy-hour');
  });

  it('applies to cart lines and adds up per offer', () => {
    const lines = applyOffers(
      [
        { dishSlug: 'cold-coffee', unitPrice: 179, quantity: 2 },
        { dishSlug: 'dal-makhani', unitPrice: 299, quantity: 1 },
        { dishSlug: 'masala-chai', unitPrice: 99, quantity: 1 },
      ],
      menu,
      [happyHour],
    );
    expect(lines.map((l) => l.offer?.discount)).toEqual([72, undefined, 20]);
    expect(offerDiscounts(lines, 100)).toEqual([
      { kind: 'offer', id: 'happy-hour', labelKey: 'happyHour', amountMinor: 9200 },
    ]);
    expect(applyOffers(lines, menu, [])).toEqual(lines.map(({ offer: _o, ...l }) => l));
  });
});

describe('promo codes', () => {
  const now = at('2026-10-08T12:00:00Z');

  it('finds a code whatever its case and spaces', () => {
    expect(findPromo(indiaPromos.codes, '  welcome10 ')).toBe(welcome10);
    expect(findPromo(indiaPromos.codes, 'NAMASTE15')).toBeUndefined();
  });

  it('turns down unknown, not yet valid, expired, other-mode and used-up codes', () => {
    const ok = { mode: 'dineIn' as const, at: now, uses: 0 };
    expect(promoProblem(welcome10, ok)).toBeNull();
    expect(promoProblem(undefined, ok)).toBe('promo_invalid');
    expect(promoProblem({ ...welcome10, validFrom: '2026-10-09T00:00:00+05:30' }, ok)).toBe(
      'promo_invalid',
    );
    expect(promoProblem({ ...welcome10, validTo: '2026-10-08T17:00:00+05:30' }, ok)).toBe(
      'promo_expired',
    );
    expect(promoProblem({ ...welcome10, validTo: '2026-10-08T18:00:00+05:30' }, ok)).toBeNull();
    expect(promoProblem(flat50, ok)).toBe('promo_mode_not_eligible');
    expect(promoProblem(flat50, { ...ok, mode: 'delivery' })).toBeNull();
    expect(promoProblem(welcome10, { ...ok, uses: 1 })).toBe('promo_limit_reached');
    expect(promoProblem(namaste15, { ...ok, uses: 5 })).toBeNull();
  });

  it('lists the codes a mode can use now', () => {
    expect(availablePromos(indiaPromos.codes, 'dineIn', now).map((p) => p.code)).toEqual([
      'WELCOME10',
    ]);
    expect(availablePromos(indiaPromos.codes, 'delivery', now).map((p) => p.code)).toEqual([
      'WELCOME10',
      'FLAT50',
    ]);
  });

  it('10% off, capped at ₹100, from a ₹299 item total', () => {
    const quote = (rupees: number, offerRupees = 0) =>
      promoDiscount(welcome10, {
        itemTotalMinor: rupees * 100,
        offerMinor: offerRupees * 100,
        minorUnit: 100,
      });
    expect(quote(748)).toEqual({ amountMinor: 7480, shortBy: 0 });
    expect(quote(1417)).toEqual({ amountMinor: 10000, shortBy: 0 });
    expect(quote(289)).toEqual({ amountMinor: 0, shortBy: 10 });
    expect(quote(299)).toEqual({ amountMinor: 2990, shortBy: 0 });
    // After happy hour: 10% of what's left.
    expect(quote(657, 72)).toEqual({ amountMinor: 5850, shortBy: 0 });
  });

  it('a flat code never takes off more than the items', () => {
    const quote = (rupees: number, offerRupees = 0) =>
      promoDiscount(flat50, {
        itemTotalMinor: rupees * 100,
        offerMinor: offerRupees * 100,
        minorUnit: 100,
      }).amountMinor;
    expect(quote(499)).toBe(5000);
    expect(promoDiscount(flat50, { itemTotalMinor: 0, offerMinor: 0, minorUnit: 100 })).toEqual({
      amountMinor: 0,
      shortBy: 499,
    });
    expect(quote(520, 490)).toBe(3000);
  });

  it('every discount on some lines: offers first, then the code when it reaches its minimum', () => {
    const lines = applyOffers(
      [
        { dishSlug: 'cold-coffee', unitPrice: 179, quantity: 2 },
        { dishSlug: 'dal-makhani', unitPrice: 299, quantity: 1 },
      ],
      testMenu(),
      [happyHour],
    );
    expect(discountsFor(lines, welcome10, 100)).toEqual([
      { kind: 'offer', id: 'happy-hour', labelKey: 'happyHour', amountMinor: 7200 },
      { kind: 'code', code: 'WELCOME10', amountMinor: 5850 },
    ]);
    expect(discountsFor(lines.slice(1), flat50, 100)).toEqual([]);
  });

  it('round-trips through the order record in major units', () => {
    const discounts: BillDiscount[] = [code(welcome10, 7480)];
    expect(toOrderDiscounts(discounts, 100)).toEqual([
      { kind: 'code', code: 'WELCOME10', amount: 74.8 },
    ]);
    expect(fromOrderDiscounts(toOrderDiscounts(discounts, 100), 100)).toEqual(discounts);
    expect(fromOrderDiscounts(undefined, 100)).toEqual([]);
  });
});

describe('tax after discount', () => {
  const lines = [
    { unitPrice: 449, quantity: 1 },
    { unitPrice: 299, quantity: 1 },
  ];

  it('India: GST 5% (CGST + SGST) on the discounted items', () => {
    // ₹748 − ₹74.80 = ₹673.20; GST ₹33.66 = 16.83 + 16.83; ₹706.86 → ₹707.
    const bill = calculateBill(lines, india, undefined, [code(welcome10, 7480)]);
    expect(bill).toMatchObject({ itemTotal: 748, discountMinor: 7480, total: 707 });
    expect(amount(bill, 'gst')).toBe(3366);
    expect(amount(bill, 'cgst')).toBe(1683);
    expect(amount(bill, 'sgst')).toBe(1683);
    expect(bill.roundOffMinor).toBe(14);
    expect(extrasMinor(bill)).toBe(3380);
  });

  it('India: with happy hour and WELCOME10 together', () => {
    // ₹358 + ₹299 = ₹657, −₹72 happy hour, −₹58.50 code = ₹526.50; GST ₹26.33; ₹552.83 → ₹553.
    const bill = calculateBill(
      [
        { unitPrice: 179, quantity: 2 },
        { unitPrice: 299, quantity: 1 },
      ],
      india,
      undefined,
      [
        { kind: 'offer', id: 'happy-hour', labelKey: 'happyHour', amountMinor: 7200 },
        code(welcome10, 5850),
      ],
    );
    expect(amount(bill, 'gst')).toBe(2633);
    expect(bill.total).toBe(553);
  });

  it('Nepal: service charge 10% on the discounted items, then VAT 13% on items + service', () => {
    // रू 2,270, 15% = 340.50 capped at रू 250 → रू 2,020; service रू 202; VAT 13% of 2,222 =
    // रू 288.86; रू 2,510.86 → रू 2,511.
    const bill = calculateBill(
      [
        { unitPrice: 720, quantity: 2 },
        { unitPrice: 830, quantity: 1 },
      ],
      nepal,
      undefined,
      [code(namaste15, 25000)],
    );
    expect(amount(bill, 'serviceCharge')).toBe(20200);
    expect(amount(bill, 'vat')).toBe(28886);
    expect(bill).toMatchObject({ itemTotal: 2270, total: 2511, roundOffMinor: 14 });
  });

  it('a branch that discounts after tax charges tax on the full items', () => {
    const afterTax = { ...india, tax: { ...india.tax, discountBeforeTax: false } };
    // GST on ₹748 = ₹37.40; ₹748 + ₹37.40 − ₹74.80 = ₹710.60 → ₹711.
    const bill = calculateBill(lines, afterTax, undefined, [code(welcome10, 7480)]);
    expect(amount(bill, 'gst')).toBe(3740);
    expect(bill.total).toBe(711);
    const nepalAfterTax = { ...nepal, tax: { ...nepal.tax, discountBeforeTax: false } };
    // रू 480: service 48, VAT 13% of 528 = 68.64; 480 + 48 + 68.64 − 72 = 524.64 → रू 525.
    const nepalBill = calculateBill([{ unitPrice: 480, quantity: 1 }], nepalAfterTax, undefined, [
      code(namaste15, 7200),
    ]);
    expect(nepalBill.total).toBe(525);
  });

  it('never takes off more than the items', () => {
    const bill = calculateBill([{ unitPrice: 49, quantity: 1 }], india, undefined, [
      code(flat50, 5000),
    ]);
    expect(bill).toMatchObject({ discountMinor: 4900, totalMinor: 0 });
  });

  it('an order’s bill uses the discounts the server recorded', () => {
    const bill = orderBill(
      {
        items: [
          {
            dishSlug: 'dal-makhani',
            name: 'Dal Makhani',
            veg: true,
            quantity: 1,
            details: [],
            unitPrice: 480,
          },
        ],
        discounts: [{ kind: 'code', code: 'NAMASTE15', amount: 72 }],
      },
      nepal,
    );
    // रू 408 + service 40.80 + VAT 58.34 = रू 507.14 → रू 507.
    expect(bill.discounts).toEqual([code(namaste15, 7200)]);
    expect(bill.total).toBe(507);
  });
});
