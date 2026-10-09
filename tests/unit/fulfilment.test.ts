import { describe, expect, it } from 'vitest';
import {
  rememberAddress,
  validateAddress,
  cleanAddress,
  SAVED_ADDRESS_LIMIT,
} from '@/lib/addresses';
import { createClock } from '@/lib/clock';
import {
  branchModes,
  deliveryAreas,
  deliverySummary,
  etaMinutes,
  findZone,
  isPickupSlot,
  minimumOrder,
  modePayments,
  pickupOptions,
  quoteDelivery,
} from '@/lib/fulfilment';
import { calculateBill } from '@/lib/pricing';
import type { DeliveryAddress } from '@/types/order';
import { testBranch } from '../apiState';

const india = testBranch();
const nepal = testBranch('ktm-thamel');

describe('delivery zones', () => {
  const { zones } = nepal.modes.delivery;

  it('resolves an area to its zone', () => {
    expect(findZone(zones, 'Lazimpat')?.id).toBe('ktm-thamel');
    expect(findZone(zones, 'Pulchowk')?.id).toBe('ktm-patan');
    expect(findZone(zones, 'Pokhara')).toBeUndefined();
    expect(deliveryAreas(zones)).toContain('Baneshwor');
  });

  it('quotes the fee, free delivery above the threshold, and the shortfall', () => {
    const zone = findZone(zones, 'Lazimpat')!;
    expect(quoteDelivery(zone, 'Lazimpat', 500)).toMatchObject({ fee: 60, shortBy: 300 });
    expect(quoteDelivery(zone, 'Lazimpat', 2499)).toMatchObject({ fee: 60, shortBy: 0 });
    expect(quoteDelivery(zone, 'Lazimpat', 2500)).toMatchObject({ fee: 0, baseFee: 60 });
    // A zone without a threshold always charges.
    const patan = findZone(zones, 'Sanepa')!;
    expect(quoteDelivery(patan, 'Sanepa', 9999).fee).toBe(150);
  });

  it('summarises the zones for the start screen', () => {
    expect(deliverySummary(india.modes.delivery.zones)).toEqual({
      fee: 30,
      minOrder: 199,
      etaMin: 30,
      etaMax: 55,
    });
  });
});

describe('minimum order and ETA', () => {
  it('applies the zone minimum to delivery and none to dine-in', () => {
    const quote = { minOrder: 800 };
    expect(minimumOrder(nepal, 'delivery', 460, quote)).toEqual({ minimum: 800, shortBy: 340 });
    expect(minimumOrder(nepal, 'delivery', 900, quote)).toEqual({ minimum: 800, shortBy: 0 });
    expect(minimumOrder(nepal, 'dineIn', 10)).toBeNull();
    // Takeaway has no minimum in the demo data; a branch can set one.
    expect(minimumOrder(nepal, 'takeaway', 10)).toBeNull();
    const strict = {
      modes: { ...nepal.modes, takeaway: { ...nepal.modes.takeaway, minOrder: 500 } },
    };
    expect(minimumOrder(strict, 'takeaway', 460)).toEqual({ minimum: 500, shortBy: 40 });
  });

  it('times takeaway by the prep time and delivery by the zone', () => {
    expect(etaMinutes(nepal, 'takeaway')).toBe(25);
    expect(etaMinutes(nepal, 'delivery', { etaMinutes: 45 })).toBe(45);
    expect(etaMinutes(nepal, 'delivery')).toBe(35);
  });

  it('offers each mode its own payment methods', () => {
    expect(branchModes(india)).toEqual(['dineIn', 'takeaway', 'delivery']);
    expect(modePayments(india, 'dineIn').map((o) => o.id)).toEqual(['online', 'counter']);
    expect(modePayments(india, 'takeaway').map((o) => o.id)).toEqual(['online', 'pickup']);
    expect(modePayments(nepal, 'delivery').map((o) => o.id)).toContain('cod');
  });
});

describe('pickup slots (branch time zone)', () => {
  it('Kathmandu: ASAP in 25 min, then every 15 min from opening until closing', () => {
    // 7:15 PM in Kathmandu (+5:45).
    const now = new Date('2026-10-03T13:30:00Z');
    const { asap, slots } = pickupOptions(nepal, now);
    const clock = createClock(nepal);
    expect(asap && clock.time(asap)).toBe('7:40 PM');
    expect(clock.time(slots[0])).toBe('7:45 PM');
    expect(clock.time(slots[slots.length - 1])).toBe('10:00 PM');
    expect(isPickupSlot(nepal, now, '2026-10-03T19:45:00+05:45')).toBe(true);
    expect(isPickupSlot(nepal, now, '2026-10-03T19:50:00+05:45')).toBe(false);
  });

  it('Bengaluru: the same instant is 7:00 PM there, so its slots differ', () => {
    const now = new Date('2026-10-03T13:30:00Z');
    const { asap, slots } = pickupOptions(india, now);
    const clock = createClock(india);
    expect(asap && clock.time(asap)).toBe('7:20 PM');
    expect(clock.time(slots[0])).toBe('7:30 PM');
    expect(clock.time(slots[slots.length - 1])).toBe('9:00 PM');
  });

  it('before opening: no ASAP, slots from opening plus the prep time; after closing: none', () => {
    const early = pickupOptions(india, new Date('2026-10-03T03:30:00Z')); // 9:00 AM IST
    expect(early.asap).toBeNull();
    expect(createClock(india).time(early.slots[0])).toBe('11:30 AM');
    const late = pickupOptions(india, new Date('2026-10-03T16:30:00Z')); // 10:00 PM IST
    expect(late).toEqual({ asap: null, slots: [] });
  });
});

describe('delivery fee in the bill', () => {
  const lines = [{ unitPrice: 460, quantity: 4 }];

  it('adds an untaxed fee after tax (Nepal)', () => {
    const bill = calculateBill(lines, nepal, { fee: 60, taxable: false });
    // 1,840 + service 184 + VAT 263.12 + fee 60 = 2,347.12 → 2,347
    expect(bill.deliveryFeeMinor).toBe(6000);
    expect(bill.total).toBe(2347);
  });

  it('taxes the fee when the branch says so (not the service charge)', () => {
    const bill = calculateBill(lines, nepal, { fee: 60, taxable: true });
    // VAT on 1,840 + 60 + 184 = 2,084 → 270.92; total 2,354.92 → 2,355
    expect(bill.lines.find((l) => l.id === 'vat')?.amountMinor).toBe(27092);
    expect(bill.total).toBe(2355);
  });

  it('leaves dine-in bills as they were', () => {
    expect(calculateBill([{ unitPrice: 289, quantity: 2 }], india)).toMatchObject({
      deliveryFeeMinor: null,
      total: 607,
    });
  });
});

describe('delivery addresses', () => {
  const home: DeliveryAddress = {
    line: ' Flat 3B ',
    area: 'Lazimpat',
    label: 'home',
    landmark: ' ',
  };

  it('needs a street and a served area; trims what it keeps', () => {
    expect(validateAddress({ line: '', area: 'Nowhere' }, ['Lazimpat'])).toEqual({
      line: 'lineRequired',
      area: 'areaRequired',
    });
    expect(validateAddress(home, ['Lazimpat'])).toEqual({});
    expect(cleanAddress(home)).toEqual({ line: 'Flat 3B', area: 'Lazimpat', label: 'home' });
  });

  it('remembers the latest addresses first, without duplicates', () => {
    const work: DeliveryAddress = { line: 'Office 2', area: 'Thamel', label: 'work' };
    let saved = rememberAddress([], home);
    saved = rememberAddress(saved, work);
    saved = rememberAddress(saved, { ...home, line: 'flat 3b' });
    expect(saved.map((a) => a.label)).toEqual(['home', 'work']);
    for (let i = 0; i < 5; i += 1) saved = rememberAddress(saved, { ...work, line: `Desk ${i}` });
    expect(saved).toHaveLength(SAVED_ADDRESS_LIMIT);
  });
});
