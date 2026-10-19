import { describe, expect, it } from 'vitest';
import type { ContentMap } from '@/api/queries';
import {
  CANCELLATION_REASONS,
  CUSTOMER_REQUEST_TYPES,
  DISCOUNT_TYPES,
  ELIGIBILITY_RULES,
  MASTERS,
  NOTIFICATION_TYPE_CODES,
  ORDER_STATUSES,
  ORDER_TYPES,
  PAYMENT_INSTRUMENTS,
  PAYMENT_METHOD_CODES,
  PAYMENT_REQUEST_STATUSES,
  PAYMENT_STATUSES,
  REFUND_REASONS,
  REJECTION_REASONS,
  TAX_BASES,
  TAX_TYPE_CODES,
  UNIT_CODES,
  WAITER_REQUEST_REASONS,
  convertUnit,
  isMasterValue,
  notificationsFor,
  taxRateOn,
  taxTypesFor,
} from '@/config/masters';
import { CANCEL_REASONS } from '@/lib/adminOrders';
import { REFUND_REASONS as REFUND_CHOICES } from '@/lib/adminPayments';
import { ORDER_MODES } from '@/lib/fulfilment';
import { PAYMENT_METHODS } from '@/lib/payments';
import { WAITER_REASONS } from '@/lib/service';
import type { BranchPromotions } from '@/types/promotion';
import { readApiJson, testBranches } from '../apiState';

/*
 * The master values (config/masters): every code has its words in content, the app's lists
 * are the masters', the dummy data only uses master codes, and the helpers work.
 */

const common = readApiJson<ContentMap['common']>('content/common');
const service = readApiJson<ContentMap['service']>('content/service');

const keysOf = (o: object) => Object.keys(o).sort();
const sorted = (list: readonly string[]) => [...list].sort();

describe('words for every master value', () => {
  it('for the lists that already had them', () => {
    expect(keysOf(common.modes)).toEqual(expect.arrayContaining([...ORDER_TYPES]));
    expect(keysOf(common.orderStatus)).toEqual(expect.arrayContaining([...ORDER_STATUSES]));
    expect(keysOf(common.adminOrder.cancel.reasons)).toEqual(sorted(CANCELLATION_REASONS));
    expect(keysOf(common.adminPayments.entry.reasons)).toEqual(
      expect.arrayContaining([...REFUND_REASONS]),
    );
    expect(keysOf(common.adminDashboard.paymentStatus)).toEqual(
      expect.arrayContaining(PAYMENT_STATUSES.filter((s) => s !== 'refund-started')),
    );
    expect(keysOf(service.waiterDialog.reasons)).toEqual(sorted(WAITER_REQUEST_REASONS));
    for (const id of PAYMENT_METHOD_CODES) expect(common.paymentMethods[id]).toBeTruthy();
  });

  it('for the lists added with the masters (common › masters)', () => {
    const m = common.masters;
    expect(keysOf(m.paymentInstruments)).toEqual(sorted(PAYMENT_INSTRUMENTS));
    expect(keysOf(m.paymentRequestStatuses)).toEqual(sorted(PAYMENT_REQUEST_STATUSES));
    expect(keysOf(m.taxTypes)).toEqual(sorted(TAX_TYPE_CODES));
    expect(keysOf(m.taxBases)).toEqual(sorted(TAX_BASES));
    expect(keysOf(m.rejectionReasons)).toEqual(sorted(REJECTION_REASONS));
    expect(keysOf(m.discountTypes)).toEqual(sorted(DISCOUNT_TYPES));
    expect(keysOf(m.eligibility)).toEqual(sorted(ELIGIBILITY_RULES));
    expect(keysOf(m.customerRequestTypes)).toEqual(sorted(CUSTOMER_REQUEST_TYPES.map((t) => t.id)));
    expect(keysOf(m.units)).toEqual(sorted(UNIT_CODES));
    expect(keysOf(m.notificationTypes)).toEqual(sorted(NOTIFICATION_TYPE_CODES));
  });
});

it("the app's lists are the masters'", () => {
  expect(ORDER_MODES).toEqual(ORDER_TYPES);
  expect(CANCEL_REASONS).toEqual(CANCELLATION_REASONS);
  expect(REFUND_CHOICES).toEqual(REFUND_REASONS);
  expect(WAITER_REASONS.map((r) => r.id)).toEqual(WAITER_REQUEST_REASONS);
  expect(Object.keys(PAYMENT_METHODS)).toEqual(PAYMENT_METHOD_CODES);
  expect(PAYMENT_METHODS.card).toMatchObject({ settlement: 'online', approval: 'bank' });
});

it('the dummy data uses master codes only', () => {
  for (const branch of testBranches()) {
    expect(isMasterValue('countries', branch.country)).toBe(true);
    expect(isMasterValue('branchStatuses', branch.status)).toBe(true);
    for (const line of branch.tax.lines) expect(TAX_TYPE_CODES).toContain(line.id);
    expect(taxTypesFor(branch.country)).toEqual(
      expect.arrayContaining(branch.tax.lines.map((l) => l.id)),
    );
    const methods = [
      ...branch.payments.checkout,
      ...branch.payments.bill,
      ...branch.modes.takeaway.payments,
      ...branch.modes.delivery.payments,
    ];
    for (const { id } of methods) expect(isMasterValue('paymentMethods', id)).toBe(true);
    const promos = readApiJson<BranchPromotions>(`branches/${branch.id}/promotions`);
    for (const code of promos.codes) {
      expect(isMasterValue('discountTypes', code.type)).toBe(true);
      for (const mode of code.modes) expect(isMasterValue('orderTypes', mode)).toBe(true);
    }
    for (const offer of promos.offers) {
      expect(isMasterValue('discountTypes', offer.type)).toBe(true);
      for (const day of offer.days) expect(isMasterValue('weekdays', day)).toBe(true);
    }
  }
});

describe('helpers', () => {
  it('tells a master value from anything else', () => {
    expect(isMasterValue('orderStatuses', 'preparing')).toBe(true);
    expect(isMasterValue('orderStatuses', 'pending')).toBe(false);
    expect(isMasterValue('units', 'kg')).toBe(true);
    expect(Object.keys(MASTERS)).toContain('notificationTypes');
  });

  it('reads a tax rate on a day, by its effective dates', () => {
    expect(taxRateOn('gst', '2026-10-19')).toBe(500);
    expect(taxRateOn('gst', '2020-01-01')).toBeNull();
    expect(taxTypesFor('NP')).toEqual(['vat', 'serviceCharge']);
  });

  it('converts within a dimension, never across', () => {
    expect(convertUnit(1.5, 'litre', 'ml')).toBe(1500);
    expect(convertUnit(250, 'g', 'kg')).toBe(0.25);
    expect(convertUnit(1, 'kg', 'litre')).toBeNull();
    expect(convertUnit(2, 'plate', 'piece')).toBeNull();
  });

  it('lists the notifications each audience receives', () => {
    expect(notificationsFor('kitchen')).toEqual(['newOrder', 'orderDelayed', 'orderCancelled']);
    expect(notificationsFor('floor')).toContain('serviceRequest');
  });
});
