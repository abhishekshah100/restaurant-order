import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PriceSummary, type PriceSummaryVariant } from '@/components/cart/PriceSummary';
import { GuestSessionProvider } from '@/context/GuestSessionContext';
import { calculateBill, type BillDiscount } from '@/lib/pricing';
import { ApiTestProvider, seedGuestSession, testBranch } from '../apiState';

/** The summary's rows as "label: value", for a bill at a branch the guest is at. */
function rows(
  branchId: string,
  prices: number[],
  variant: PriceSummaryVariant,
  discounts: BillDiscount[] = [],
): string[] {
  seedGuestSession({ branchId, table: 5 });
  const bill = calculateBill(
    prices.map((unitPrice) => ({ unitPrice, quantity: 1 })),
    testBranch(branchId),
    undefined,
    discounts,
  );
  const { container } = render(
    <ApiTestProvider>
      <GuestSessionProvider>
        <PriceSummary bill={bill} variant={variant} />
      </GuestSessionProvider>
    </ApiTestProvider>,
  );
  return [...container.querySelectorAll('dl > div')].map(
    (row) => `${row.querySelector('dt')?.textContent}: ${row.querySelector('dd')?.textContent}`,
  );
}

const INDIA = 'blr-indiranagar';
const NEPAL = 'ktm-thamel';

describe('PriceSummary', () => {
  it('India, split: CGST, SGST, service charge not added, round off (as drawn)', () => {
    expect(rows(INDIA, [549, 409, 199, 199], 'split')).toEqual([
      'Item total: ₹1,356.00',
      'CGST (2.5%): ₹33.90',
      'SGST (2.5%): ₹33.90',
      'Service charge: Not added',
      'Round off: +₹0.20',
      'To pay: ₹1,424',
    ]);
  });

  it('India, combined, compact and receipt', () => {
    expect(rows(INDIA, [549], 'combined')).toEqual([
      'Item total: ₹549.00',
      'CGST + SGST (5%): ₹27.45',
      'Round off: −₹0.45',
      'To pay: ₹576',
    ]);
    expect(rows(INDIA, [549, 409, 199, 199], 'compact')).toEqual([
      'Item total: ₹1,356.00',
      'GST 5% + round off: ₹68.00',
      'To pay: ₹1,424',
    ]);
    expect(rows(INDIA, [549], 'receipt')).not.toContain('Service charge: Not added');
  });

  it('Nepal, split: service charge (10%), VAT (13%), round off, and no GST', () => {
    const nbsp = (s: string) => s.replace(/ /g, ' ');
    expect(rows(NEPAL, [880, 655, 745], 'split')).toEqual([
      `Item total: ${nbsp('रू 2,280.00')}`,
      `Service charge (10%): ${nbsp('रू 228.00')}`,
      `VAT (13%): ${nbsp('रू 326.04')}`,
      `Round off: ${nbsp('−रू 0.04')}`,
      `To pay: ${nbsp('रू 2,834')}`,
    ]);
    expect(rows(NEPAL, [880], 'compact')[1]).toMatch(/^Service charge, VAT \+ round off: /);
  });

  it('discounts follow the item total: happy hour, then the promo code', () => {
    const discounts: BillDiscount[] = [
      { kind: 'offer', id: 'happy-hour', labelKey: 'happyHour', amountMinor: 4000 },
      { kind: 'code', code: 'WELCOME10', amountMinor: 7080 },
    ];
    // ₹199 + ₹549 = ₹748 − ₹40 − ₹70.80 = ₹637.20 + GST ₹31.86 = ₹669.06 → ₹669.
    expect(rows(INDIA, [199, 549], 'combined', discounts)).toEqual([
      'Item total: ₹748.00',
      'Happy hour: −₹40.00',
      'Promo WELCOME10: −₹70.80',
      'CGST + SGST (5%): ₹31.86',
      'Round off: −₹0.06',
      'To pay: ₹669',
    ]);
    expect(rows(INDIA, [199, 549], 'compact', discounts)).toEqual([
      'Item total: ₹748.00',
      'Happy hour: −₹40.00',
      'Promo WELCOME10: −₹70.80',
      'GST 5% + round off: ₹31.80',
      'To pay: ₹669',
    ]);
  });
});
