import { describe, expect, it } from 'vitest';
import { weekdayAt, withSchedule, type ScheduleLabels } from '@/lib/branchHours';
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
import type { Branch, OpeningSchedule } from '@/types/branch';
import { WEEKDAYS } from '@/types/branch';
import { testBranch } from '../apiState';

/*
 * A branch's settings (lib/branchSettings) and its opening hours (lib/branchHours): what the
 * Settings pages read off a branch, the problems they refuse, and the branch they write back.
 */

const india = testBranch('blr-indiranagar');
const nepal = testBranch('ktm-thamel');
const labels: ScheduleLabels = {
  lastOrdersNote: (minutes) => `${minutes} min before close`,
  closedToday: 'Closed today',
};
// Thursday 15 Oct 2026, 6:30 PM in Bengaluru.
const THURSDAY = new Date('2026-10-15T13:00:00Z');

const week = (over: Partial<OpeningSchedule> = {}): OpeningSchedule => ({
  days: Object.fromEntries(
    WEEKDAYS.map((d) => [d, { open: true, opens: '11:00', closes: '21:00' }]),
  ) as OpeningSchedule['days'],
  lastOrdersMinutes: 30,
  windows: [{ label: 'Lunch', from: '12:00', to: '15:30' }],
  ...over,
});

describe('opening hours (lib/branchHours)', () => {
  it("knows the day of the week in the branch's time zone", () => {
    expect(weekdayAt(THURSDAY, india.timezone)).toBe('thu');
    // 12:45 AM on Friday in Kathmandu, still Thursday in UTC.
    expect(weekdayAt(new Date('2026-10-15T19:00:00Z'), nepal.timezone)).toBe('fri');
  });

  it("works out today's hours, last orders and service windows from the week", () => {
    const branch = withSchedule(
      { ...india, schedule: week({ lastOrdersMinutes: 45 }) },
      THURSDAY,
      labels,
    );
    expect(branch.hours).toEqual({ opens: '11:00', closes: '21:00' });
    expect(branch.opensAt).toBe('11:00 AM');
    expect(branch.closesAt).toBe('9:00 PM');
    expect(branch.hoursToday).toBe('11:00 AM – 9:00 PM');
    expect(branch.lastOrders).toBe('8:15 PM');
    expect(branch.lastOrdersNote).toBe('45 min before close');
    expect(branch.serviceWindows).toEqual([{ label: 'Lunch', hours: '12:00 PM – 3:30 PM' }]);
    expect(branch.status).toBe('open');
    expect(branch.reopensOn).toBeUndefined();
  });

  it('is closed on a day it shuts, until its next opening day', () => {
    const shut = { open: false, opens: '11:00', closes: '21:00' };
    const schedule = week();
    const thursdayOff = withSchedule(
      { ...india, schedule: { ...schedule, days: { ...schedule.days, thu: shut } } },
      THURSDAY,
      labels,
    );
    expect(thursdayOff).toMatchObject({
      status: 'closed',
      reopensOn: 'fri',
      reopensTomorrow: true,
      opensAt: '11:00 AM',
      hoursToday: 'Closed today',
    });

    const longWeekend = withSchedule(
      {
        ...india,
        schedule: {
          ...schedule,
          days: {
            ...schedule.days,
            thu: shut,
            fri: shut,
            sat: { open: true, opens: '09:30', closes: '14:00' },
          },
        },
      },
      THURSDAY,
      labels,
    );
    expect(longWeekend).toMatchObject({ status: 'closed', reopensOn: 'sat', opensAt: '9:30 AM' });
    expect(longWeekend.reopensTomorrow).toBeUndefined();
  });

  it('refuses a week that never opens, days that close before they open, and late last orders', () => {
    expect(hoursErrors(week())).toEqual([]);
    const shut = Object.fromEntries(
      WEEKDAYS.map((d) => [d, { open: false, opens: '11:00', closes: '21:00' }]),
    ) as OpeningSchedule['days'];
    expect(hoursErrors(week({ days: shut }))).toContain('noOpenDay');
    const base = week();
    expect(
      hoursErrors(
        week({ days: { ...base.days, mon: { open: true, opens: '22:00', closes: '10:00' } } }),
      ),
    ).toContain('dayOrder');
    expect(
      hoursErrors(
        week({ days: { ...base.days, mon: { open: true, opens: '', closes: '10:00' } } }),
      ),
    ).toContain('dayTime');
    expect(
      hoursErrors(
        week({
          lastOrdersMinutes: 120,
          days: { ...base.days, sun: { open: true, opens: '12:00', closes: '13:30' } },
        }),
      ),
    ).toContain('lastOrders');
    // A closed day's times don't matter.
    expect(
      hoursErrors(week({ days: { ...base.days, sun: { open: false, opens: '', closes: '' } } })),
    ).toEqual([]);
  });

  it('refuses unnamed, repeated or back-to-front service windows', () => {
    expect(hoursErrors(week({ windows: [{ label: ' ', from: '12:00', to: '15:00' }] }))).toContain(
      'windowLabel',
    );
    expect(
      hoursErrors(
        week({
          windows: [
            { label: 'Lunch', from: '12:00', to: '15:00' },
            { label: 'lunch', from: '13:00', to: '16:00' },
          ],
        }),
      ),
    ).toContain('windowLabelTaken');
    expect(
      hoursErrors(week({ windows: [{ label: 'Dinner', from: '22:00', to: '19:00' }] })),
    ).toContain('windowOrder');
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

  it('writes them back tidied, with the phone link, and a new map link for a new address', () => {
    const next = withDetails(india, {
      ...detailsOf(india),
      name: '  The Olive Table  ',
      phone: '+91 98263 14093',
    });
    expect(next.name).toBe('The Olive Table');
    expect(next.phone).toBe('+919826314093');
    expect(next.phoneHref).toBe('tel:+919826314093');
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

it('reads every section off a branch and the branch data agrees with its week', () => {
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
  // The published strings are what the week works out to (prerendered pages match).
  for (const branch of [india, nepal] as Branch[]) {
    const today = withSchedule(branch, THURSDAY, labels);
    expect(today.hoursToday).toBe(branch.hoursToday);
    expect(today.lastOrders).toBe(branch.lastOrders);
    expect(today.serviceWindows).toEqual(branch.serviceWindows);
    expect(today.lastOrdersNote).toBe(branch.lastOrdersNote);
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
