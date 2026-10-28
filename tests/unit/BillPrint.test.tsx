import { describe, expect, it } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useBillPrint } from '@/components/admin/payments/PaymentPrint';
import { createClock } from '@/lib/clock';
import { createMoney } from '@/lib/money';
import type { Order } from '@/types/order';
import { ApiTestProvider, testBranch, testOrderHistory } from '../apiState';

/* The guest's "Get invoice" prints the bill staff print from Payments, for the order's branch. */

const branch = testBranch();
const order = testOrderHistory().history.find((o) => o.id === 'A104') as Order;

function Invoice() {
  const invoice = useBillPrint({
    region: branch,
    money: createMoney(branch),
    clock: createClock(branch),
  });
  return (
    <>
      <button type="button" onClick={() => invoice.bill([order])}>
        Get invoice
      </button>
      {invoice.sheet}
    </>
  );
}

describe('useBillPrint', () => {
  it("puts the staff bill in the page: the branch, the order's items, charges and total", async () => {
    window.print = () => undefined;
    const { getByRole, findByRole } = render(
      <ApiTestProvider>
        <Invoice />
      </ApiTestProvider>,
    );
    await act(async () => {
      fireEvent.click(await findByRole('button', { name: 'Get invoice' }));
    });
    const sheet = document.querySelector('[data-print-sheet]');
    expect(sheet).not.toBeNull();
    const text = sheet?.textContent ?? '';
    expect(text).toContain(branch.shortName);
    expect(text).toContain(order.id);
    for (const item of order.items) expect(text).toContain(item.name);
    expect(text).toContain('CGST');
    expect(text).toContain(createMoney(branch).format(order.total));
    expect(getByRole('button', { name: 'Get invoice' })).toBeTruthy();
  });
});
