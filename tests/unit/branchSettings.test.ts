import { describe, expect, it } from 'vitest';
import { branchTimes, nextOpeningAfterToday, scheduleStatus, weekdayAt } from '@/lib/branchHours';
import {
  deliveryErrors,
  detailsErrors,
  detailsOf,
  hoursErrors,
  paymentChoicesFor,
  servicesErrors,
  servicesOf,
  withRegion,
  withServices,
  paymentErrors,
  paymentsOf,
  pickupErrors,
  settingsOf,
  splitRate,
  taxErrors,
  taxOf,
  uniqueId,
  withDetails,
  withPayments,
  withTax,
} from '@/lib/branchSettings';
import { calculateBill } from '@/lib/pricing';
import type { Branch, OpeningSchedule, Session } from '@/types/branch';
import { WEEKDAYS } from '@/types/branch';
import { testBranch } from '../apiState';

/*
 * A branch's settings (lib/branchSettings) and its opening hours (lib/branchHours): what the
 * Settings pages read off a branch, the problems they refuse, and the branch they write back.
 */

const india = testBranch('blr-indiranagar');
const nepal = testBranch('ktm-thamel');
// Thursday 15 Oct 2026, 6:30 PM in Bengaluru.
const THURSDAY = new Date('2026-10-15T13:00:00Z');

const week = (over: Partial<OpeningSchedule> = {}): OpeningSchedule => ({
  days: Object.fromEntries(
    WEEKDAYS.map((d) => [d, [{ opens: '11:00', closes: '21:00' }]]),
  ) as OpeningSchedule['days'],
  lastOrdersMinutes: 30,
  takeaway: null,
  delivery: null,
  specialDays: [],
  ...over,
});
/** The week with Monday's sessions set. */
const withMonday = (mon: OpeningSchedule['days']['mon'], over: Partial<OpeningSchedule> = {}) => {
  const base = week(over);
  return { ...base, days: { ...base.days, mon } };
};

describe('opening hours (lib/branchHours)', () => {
  it("knows the day of the week in the branch's time zone", () => {
    expect(weekdayAt(THURSDAY, india.timezone)).toBe('thu');
    // 12:45 AM on Friday in Kathmandu, still Thursday in UTC.
    expect(weekdayAt(new Date('2026-10-15T19:00:00Z'), nepal.timezone)).toBe('fri');
  });

  it('takes orders inside a session until its last orders', () => {
    // 6:30 PM: open, orders until 8:30 PM (15:00 UTC).
    const times = branchTimes({ ...india, status: 'open', schedule: week() }, THURSDAY);
    expect(times).toEqual({
      today: [{ opens: '11:00', closes: '21:00' }],
      ordersUntil: new Date('2026-10-15T15:00:00.000Z'),
      reopens: null,
      pausedMinutes: 0,
    });
    // 8:45 PM: after last orders, closed until tomorrow's 11:00.
    expect(
      scheduleStatus({ ...india, schedule: week() }, new Date('2026-10-15T15:15:00Z')),
    ).toEqual({ status: 'closed', until: new Date('2026-10-16T05:30:00.000Z') });
  });

  it('closes between sessions, and keeps a session open past midnight', () => {
    const split = {
      ...week(),
      days: {
        ...week().days,
        thu: [
          { label: 'Lunch', opens: '12:00', closes: '15:30' },
          { label: 'Dinner', opens: '19:00', closes: '23:30' },
        ],
      },
    };
    // 6:30 PM: the afternoon break, closed until dinner at 7:00 PM.
    expect(scheduleStatus({ ...india, schedule: split }, THURSDAY)).toEqual({
      status: 'closed',
      until: new Date('2026-10-15T13:30:00.000Z'),
    });
    // Thursday 18:00 to Friday 02:00; at 1:00 AM Friday orders run until 1:30 AM.
    const late = {
      ...week(),
      days: { ...week().days, thu: [{ opens: '18:00', closes: '02:00' }] },
    };
    expect(scheduleStatus({ ...india, schedule: late }, new Date('2026-10-15T19:30:00Z'))).toEqual({
      status: 'open',
      until: new Date('2026-10-15T20:00:00.000Z'),
    });
  });

  it('is closed on a day it shuts, until its next opening day', () => {
    const schedule = week();
    const thursdayOff = branchTimes(
      {
        ...india,
        status: 'closed',
        schedule: { ...schedule, days: { ...schedule.days, thu: [] } },
      },
      THURSDAY,
    );
    expect(thursdayOff.today).toEqual([]);
    // Friday 11:00 AM in Bengaluru.
    expect(thursdayOff.reopens).toEqual({
      at: new Date('2026-10-16T05:30:00.000Z'),
      daysAhead: 1,
      day: 'fri',
    });

    const longWeekend = branchTimes(
      {
        ...india,
        status: 'closed',
        schedule: {
          ...schedule,
          days: { ...schedule.days, thu: [], fri: [], sat: [{ opens: '09:30', closes: '14:00' }] },
        },
      },
      THURSDAY,
    );
    expect(longWeekend.reopens).toEqual({
      at: new Date('2026-10-17T04:00:00.000Z'),
      daysAhead: 2,
      day: 'sat',
    });
  });

  it('opens later today when closed before opening time', () => {
    // 9:30 AM in Bengaluru, before 11:00.
    const morning = new Date('2026-10-15T04:00:00Z');
    const times = branchTimes({ ...india, status: 'closed', schedule: week() }, morning);
    expect(times.reopens).toEqual({
      at: new Date('2026-10-15T05:30:00.000Z'),
      daysAhead: 0,
      day: 'thu',
    });
  });

  it('follows what the server says: a pause counts down, a day closed opens at statusUntil', () => {
    const paused = branchTimes(
      {
        ...india,
        status: 'paused',
        statusUntil: new Date(THURSDAY.getTime() + 19.5 * 60_000).toISOString(),
        schedule: week(),
      },
      THURSDAY,
    );
    expect(paused.pausedMinutes).toBe(20);
    expect(paused.reopens).toBeNull();

    const closedForTheDay = branchTimes(
      { ...india, status: 'closed', statusUntil: '2026-10-16T05:30:00.000Z', schedule: week() },
      THURSDAY,
    );
    expect(closedForTheDay.today).toEqual([{ opens: '11:00', closes: '21:00' }]);
    expect(closedForTheDay.reopens).toMatchObject({ daysAhead: 1, day: 'fri' });
    // The same moment closing for the rest of today waits for.
    expect(nextOpeningAfterToday({ ...india, schedule: week() }, THURSDAY)?.at).toEqual(
      closedForTheDay.reopens?.at,
    );
  });

  it("follows special dates (for every way of ordering), and delivery's own week", () => {
    // Thursday a holiday; Friday opens late.
    const holiday = week({
      specialDays: [
        { from: '2026-10-15', to: '2026-10-15', label: 'Holiday', sessions: [] },
        { from: '2026-10-16', to: '2026-10-16', sessions: [{ opens: '17:00', closes: '23:00' }] },
      ],
    });
    expect(scheduleStatus({ ...india, schedule: holiday }, THURSDAY)).toEqual({
      status: 'closed',
      until: new Date('2026-10-16T11:30:00.000Z'), // Friday 5:00 PM
    });
    expect(scheduleStatus({ ...india, schedule: holiday }, THURSDAY, 'delivery').status).toBe(
      'closed',
    );
    // Delivery on its own hours until 11 PM: at 9:00 PM the dining room's last orders have gone.
    const late = Object.fromEntries(
      WEEKDAYS.map((d) => [d, [{ opens: '11:00', closes: '23:00' }]]),
    ) as OpeningSchedule['days'];
    const nine = new Date('2026-10-15T15:30:00Z');
    const branch = { ...india, status: 'closed' as const, schedule: week({ delivery: late }) };
    expect(branchTimes(branch, nine).reopens?.daysAhead).toBe(1);
    // Delivery open, with no time from the server: its own hours say until 10:30 PM.
    const delivering = {
      ...branch,
      modeStatus: {
        takeaway: { status: 'closed' as const },
        delivery: { status: 'open' as const },
      },
    };
    expect(branchTimes(delivering, nine, 'delivery').ordersUntil).toEqual(
      new Date('2026-10-15T17:00:00.000Z'),
    );
  });

  it('checks special dates and the modes’ own weeks', () => {
    const diwali = { from: '2026-11-08', to: '2026-11-09', label: 'Diwali', sessions: [] };
    expect(hoursErrors(week({ specialDays: [diwali] }))).toEqual([]);
    expect(hoursErrors(week({ specialDays: [{ ...diwali, to: '2026-11-07' }] }))).toEqual([
      'specialDates',
    ]);
    expect(
      hoursErrors(
        week({ specialDays: [diwali, { ...diwali, from: '2026-11-09', to: '2026-11-11' }] }),
      ),
    ).toEqual(['specialOverlap']);
    const closed = Object.fromEntries(
      WEEKDAYS.map((d) => [d, [] as Session[]]),
    ) as OpeningSchedule['days'];
    expect(hoursErrors(week({ takeaway: closed }))).toEqual([]);
    expect(
      hoursErrors(
        week({
          takeaway: {
            ...closed,
            mon: [
              { opens: '11:00', closes: '15:00' },
              { opens: '14:00', closes: '18:00' },
            ],
          },
        }),
      ),
    ).toEqual(['sessionOverlap']);
  });

  it('takes split shifts, a session past midnight and one all day', () => {
    expect(hoursErrors(week())).toEqual([]);
    expect(
      hoursErrors(
        withMonday([
          { label: 'Lunch', opens: '12:00', closes: '15:30' },
          { label: 'Dinner', opens: '19:00', closes: '23:30' },
        ]),
      ),
    ).toEqual([]);
    expect(hoursErrors(withMonday([{ opens: '18:00', closes: '02:00' }]))).toEqual([]);
    expect(hoursErrors(withMonday([{ opens: '00:00', closes: '24:00' }]))).toEqual([]);
    expect(hoursErrors(withMonday([]))).toEqual([]);
  });

  it('refuses a week that never opens, bad times, overlaps and late last orders', () => {
    const shut = Object.fromEntries(
      WEEKDAYS.map((d) => [d, [] as Session[]]),
    ) as OpeningSchedule['days'];
    expect(hoursErrors(week({ days: shut }))).toEqual(['noOpenDay']);
    expect(hoursErrors(withMonday([{ opens: '', closes: '10:00' }]))).toEqual(['sessionTime']);
    expect(
      hoursErrors(
        withMonday([
          { opens: '12:00', closes: '16:00' },
          { opens: '15:00', closes: '22:00' },
        ]),
      ),
    ).toEqual(['sessionOverlap']);
    // Past midnight into Tuesday's 11:00 opening.
    expect(hoursErrors(withMonday([{ opens: '18:00', closes: '12:00' }]))).toEqual([
      'sessionOverlap',
    ]);
    expect(
      hoursErrors(
        withMonday(Array.from({ length: 5 }, () => ({ opens: '11:00', closes: '12:00' }))),
      ),
    ).toContain('tooManySessions');
    expect(
      hoursErrors(withMonday([{ label: 'x'.repeat(31), opens: '11:00', closes: '21:00' }])),
    ).toEqual(['sessionLabel']);
    // A 90-minute session can't have last orders 2 hours before it ends.
    expect(
      hoursErrors(withMonday([{ opens: '12:00', closes: '13:30' }], { lastOrdersMinutes: 120 })),
    ).toEqual(['lastOrders']);
  });
});

describe('branch details', () => {
  it("needs the names, address and a phone with the region's country code", () => {
    const details = detailsOf(india);
    expect(detailsErrors(details)).toEqual([]);
    expect(detailsErrors({ ...details, name: ' ', city: '' })).toEqual([
      'nameRequired',
      'cityRequired',
    ]);
    expect(detailsErrors({ ...details, phone: '+977 9852024631' })).toEqual(['phoneRegion']);
    expect(detailsErrors({ ...details, phone: '98263' })).toEqual(['phoneInvalid']);
    expect(detailsErrors(details, ['Thamel', details.shortName.toUpperCase()])).toEqual([
      'shortNameTaken',
    ]);
    // The Wi-Fi name may be left empty.
    expect(detailsErrors({ ...details, wifiName: '' })).toEqual([]);
  });

  it('writes them back tidied, and a new map link for a new address', () => {
    const next = withDetails(india, {
      ...detailsOf(india),
      name: '  The Olive Table  ',
      phone: '+91 98263 14093',
    });
    expect(next.name).toBe('The Olive Table');
    expect(next.phone).toBe('+919826314093');
    expect(next.mapUrl).toBe(india.mapUrl);
    const moved = withDetails(india, { ...detailsOf(india), address: 'MG Road, Bengaluru' });
    expect(moved.mapUrl).toBe(
      'https://www.google.com/maps/search/?api=1&query=MG%20Road%2C%20Bengaluru',
    );
  });
});

describe('tax and service charge', () => {
  it('changes rates, splits GST evenly and the bill follows', () => {
    const tax = taxOf(india);
    expect(tax).toEqual({
      serviceChargeBp: null,
      lines: [
        {
          id: 'gst',
          labelKey: 'gst',
          rateBp: 500,
          base: 'items',
          parts: [
            { id: 'cgst', labelKey: 'cgst' },
            { id: 'sgst', labelKey: 'sgst' },
          ],
        },
      ],
      discountBeforeTax: true,
      roundTotal: true,
    });
    expect(splitRate(1200, 2)).toEqual([600, 600]);
    expect(splitRate(151, 2)).toEqual([76, 75]);

    const next = withTax(india, {
      ...tax,
      lines: [{ ...tax.lines[0], rateBp: 1800 }],
      serviceChargeBp: 1000,
      roundTotal: false,
    });
    expect(next.tax.lines[0].splitInto?.map((p) => p.rateBp)).toEqual([900, 900]);
    expect(next.tax.serviceCharge).toEqual({ labelKey: 'serviceCharge', rateBp: 1000 });
    expect(next.tax.rounding).toEqual({ unit: 1, showRoundOff: false });
    const bill = calculateBill([{ unitPrice: 1000, quantity: 1 }], next);
    // ₹1,000 + 10% service + 18% GST on the items.
    expect(bill.totalMinor).toBe(100000 + 10000 + 18000);

    const off = withTax(next, { ...taxOf(next), serviceChargeBp: null });
    expect(off.tax.serviceCharge).toBeUndefined();
  });

  it('refuses rates out of range and a different set of taxes', () => {
    const tax = taxOf(nepal);
    expect(taxErrors(tax, tax)).toEqual([]);
    expect(taxErrors({ ...tax, lines: [{ ...tax.lines[0], rateBp: 6000 }] }, tax)).toEqual([
      'taxRate',
    ]);
    expect(taxErrors({ ...tax, serviceChargeBp: 0 }, tax)).toEqual(['serviceRate']);
    expect(taxErrors({ ...tax, lines: [] }, tax)).toEqual(['taxLines']);
  });
});

describe('payment methods', () => {
  it("offers the region's methods, in staff's order, with the one marked Fastest", () => {
    const choices = paymentChoicesFor('NP');
    const payments = paymentsOf(nepal);
    expect(paymentErrors(payments, choices)).toEqual([]);

    const next = withPayments(
      nepal,
      {
        ...payments,
        checkout: { methods: ['card', 'counter'], recommended: 'card' },
        delivery: { methods: ['cod'], recommended: null },
      },
      choices,
    );
    expect(next.payments.checkout).toEqual([
      { id: 'card', labelKey: 'card', recommended: true },
      { id: 'counter', labelKey: 'counterNoUpi' },
    ]);
    expect(next.modes.delivery.payments).toEqual([{ id: 'cod', labelKey: 'codNoUpi' }]);
    expect(paymentsOf(next).checkout).toEqual({
      methods: ['card', 'counter'],
      recommended: 'card',
    });
  });

  it('needs a method on every screen, from the region, and Fastest among them', () => {
    const choices = paymentChoicesFor('IN');
    const payments = paymentsOf(india);
    expect(
      paymentErrors({ ...payments, bill: { methods: [], recommended: null } }, choices),
    ).toEqual(['noMethods']);
    expect(
      paymentErrors({ ...payments, checkout: { methods: ['esewa'], recommended: null } }, choices),
    ).toEqual(['unknownMethod']);
    expect(
      paymentErrors(
        { ...payments, checkout: { methods: ['counter'], recommended: 'online' } },
        choices,
      ),
    ).toEqual(['recommended']);
    expect(paymentErrors({ ...payments, atTable: [] }, choices)).toEqual(['noAtTable']);
  });
});

describe('delivery zones and pickup', () => {
  it('refuses an area in two zones, a missing name and delivery on without zones', () => {
    const delivery = settingsOf(india).delivery;
    expect(deliveryErrors(delivery)).toEqual([]);
    const [near, mid] = delivery.zones;
    expect(
      deliveryErrors({ ...delivery, zones: [near, { ...mid, areas: [...mid.areas, ' domlur '] }] }),
    ).toContain('areaTaken');
    expect(deliveryErrors({ ...delivery, zones: [{ ...near, name: '' }] })).toContain('zoneName');
    expect(deliveryErrors({ ...delivery, zones: [] })).toEqual(['noZones']);
    expect(deliveryErrors({ ...delivery, enabled: false, zones: [] })).toEqual([]);
    expect(deliveryErrors({ ...delivery, zones: [{ ...near, freeAbove: 0 }] })).toContain(
      'freeAbove',
    );
  });

  it('takes slot lengths from the list and a kitchen time of 5 minutes or more', () => {
    const pickup = settingsOf(india).pickup;
    expect(pickupErrors(pickup)).toEqual([]);
    expect(pickupErrors({ ...pickup, slotMinutes: 7 })).toEqual(['slotMinutes']);
    expect(pickupErrors({ ...pickup, prepMinutes: 2 })).toEqual(['prepMinutes']);
  });

  it('makes ids from names, never one already taken', () => {
    expect(uniqueId('Koramangala & Ulsoor', new Set())).toBe('koramangala-ulsoor');
    expect(uniqueId('Patan', new Set(['patan', 'patan-2']))).toBe('patan-3');
    expect(uniqueId('!!!', new Set(), 'zone')).toBe('zone');
  });
});

it('reads every section off a branch, and the branch data carries only its week', () => {
  const settings = settingsOf(india);
  expect(Object.keys(settings)).toEqual([
    'details',
    'services',
    'hours',
    'tax',
    'payments',
    'delivery',
    'pickup',
  ]);
  expect(hoursErrors(settings.hours)).toEqual([]);
  // The published data has the week only: every time a screen shows is worked out from it.
  for (const branch of [india, nepal] as Branch[]) {
    expect(hoursErrors(branch.schedule)).toEqual([]);
    for (const gone of ['hoursToday', 'opensAt', 'closesAt', 'lastOrdersNote', 'tables']) {
      expect(branch).not.toHaveProperty(gone);
    }
  }
});

describe('region and services', () => {
  it('moves a branch to another country with its phone rules, taxes and payment methods', () => {
    const moved = withRegion(india, {
      country: 'NP',
      timezone: 'Asia/Kathmandu',
      locale: 'en-NP',
      currency: 'NPR',
    });
    expect(moved.mobile).toEqual(nepal.mobile);
    expect(moved.tax).toEqual(nepal.tax);
    expect(moved.payments).toEqual(nepal.payments);
    expect(moved.modes.delivery.payments).toEqual(nepal.modes.delivery.payments);
    expect(moved.localeFallback).toBe('en-IN');
    expect(moved.currency).toEqual(nepal.currency);
    // Its zones and opening hours stay.
    expect(moved.modes.delivery.zones).toEqual(india.modes.delivery.zones);

    // Same country: only the time zone, locale and currency change.
    const dollars = withRegion(india, {
      country: 'IN',
      timezone: 'Asia/Kolkata',
      locale: 'en-US',
      currency: 'USD',
    });
    expect(dollars.tax).toEqual(india.tax);
    expect(dollars.localeFallback).toBeUndefined();
    expect(dollars.currency).toEqual({ code: 'USD', symbol: '$', minorUnit: 100, nameKey: 'usd' });
  });

  it("checks the region, and the phone against the new country's code", () => {
    const details = detailsOf(india);
    expect(detailsErrors({ ...details, country: 'NP' })).toEqual(['phoneRegion']);
    expect(detailsErrors({ ...details, timezone: 'Mars/Olympus' })).toEqual(['timezone']);
    expect(detailsErrors({ ...details, locale: 'fr-FR', currency: 'XYZ' })).toEqual([
      'locale',
      'currency',
    ]);
  });

  it('keeps at least one service, and delivery only with a zone', () => {
    const services = servicesOf(india);
    expect(services).toEqual({ dineIn: true, takeaway: true, delivery: true });
    expect(servicesErrors(services, 3)).toEqual([]);
    expect(servicesErrors({ dineIn: false, takeaway: false, delivery: false }, 3)).toEqual([
      'noService',
    ]);
    expect(servicesErrors({ ...services, delivery: true }, 0)).toEqual(['deliveryNeedsZones']);
    expect(withServices(india, { ...services, dineIn: false }).modes.dineIn.enabled).toBe(false);
  });
});
