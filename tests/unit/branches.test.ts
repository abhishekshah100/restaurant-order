import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/api/translator';
import type { ContentMap } from '@/api/queries';
import { PAYMENT_METHODS } from '@/lib/payments';
import { readApiJson, testBranches, testMenu, testRestaurant } from '../apiState';

/*
 * The branch data is the contract with the backend: every content key it names must exist,
 * so a new branch or region can't ship with a blank label.
 */

const branches = testBranches();
const cart = readApiJson<ContentMap['cart']>('content/cart');
const checkout = readApiJson<ContentMap['checkout']>('content/checkout');
const service = readApiJson<ContentMap['service']>('content/service');
const common = createTranslator(readApiJson<ContentMap['common']>('content/common'));
const checkoutText = createTranslator(checkout);

describe('GET /branches', () => {
  it('has the default branch', () => {
    expect(branches.map((b) => b.id)).toContain(testRestaurant().defaultBranchId);
  });

  it.each(branches.map((b) => [b.id, b] as const))('%s: names only content that exists', (_, b) => {
    const lines = cart.priceSummary.lines;
    const taxKeys = [
      ...(b.tax.serviceCharge ? [b.tax.serviceCharge.labelKey] : []),
      ...b.tax.lines.flatMap((l) => [l.labelKey, ...(l.splitInto ?? []).map((p) => p.labelKey)]),
    ];
    for (const key of taxKeys) expect(lines).toHaveProperty(key);
    expect(cart.priceSummary.compact).toHaveProperty(b.tax.compactLabelKey);
    for (const o of b.payments.checkout)
      expect(checkout.payment.methods).toHaveProperty(o.labelKey);
    for (const o of b.payments.bill) expect(service.payBill.methods).toHaveProperty(o.labelKey);
    for (const o of [...b.payments.checkout, ...b.payments.bill]) {
      expect(PAYMENT_METHODS).toHaveProperty(o.id);
      expect(common(`paymentMethods.${o.id}`)).not.toBe(`paymentMethods.${o.id}`);
    }
    expect(checkoutText(`details.errors.phonePrefix.${b.country}`)).not.toContain('details.');
    expect(common.get('currencyNames')).toHaveProperty(b.currency.nameKey);
    expect(service.region.taxInvoice).toHaveProperty(b.tax.invoiceKey);
    for (const m of b.payments.atTable) expect(service.region.atTable).toHaveProperty(m);
  });

  it.each(branches.map((b) => [b.id, b] as const))('%s: split tax parts add up', (_, b) => {
    for (const line of b.tax.lines) {
      if (!line.splitInto) continue;
      expect(line.splitInto.reduce((sum, p) => sum + p.rateBp, 0)).toBe(line.rateBp);
    }
  });

  it.each(branches.map((b) => [b.id, b] as const))(
    '%s: its default table is in range and phone groups cover the number',
    (_, b) => {
      expect(b.defaultTable).toBeGreaterThanOrEqual(b.tables.first);
      expect(b.defaultTable).toBeLessThanOrEqual(b.tables.last);
      expect(b.mobile.groups.reduce((a, n) => a + n, 0)).toBe(b.mobile.length);
      expect(() => new RegExp(b.mobile.pattern)).not.toThrow();
    },
  );

  it('every branch serves the same dishes, priced in its own currency', () => {
    const [first, ...rest] = branches.map((b) => testMenu(b.id));
    for (const menu of rest) {
      expect(menu.dishes.map((d) => d.slug)).toEqual(first.dishes.map((d) => d.slug));
    }
    const nepal = testMenu('ktm-thamel');
    expect(nepal.dishes.every((d) => d.price % 5 === 0)).toBe(true);
  });
});
