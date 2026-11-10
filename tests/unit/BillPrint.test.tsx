import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { useBillDownload } from '@/components/admin/payments/PaymentPrint';
import { createClock } from '@/lib/clock';
import { createMoney } from '@/lib/money';
import type { Order } from '@/types/order';
import { ApiTestProvider, testBranch, testOrderHistory } from '../apiState';

/*
 * The guest's "Get invoice" saves the bill staff print from Payments, for the order's branch, as
 * a PDF file: the bill is drawn (html2canvas reads it) and saved (jsPDF), then taken away.
 */

const drawn = vi.hoisted(() => ({ text: '', saved: '' }));

vi.mock('html2canvas', () => ({
  default: vi.fn((node: HTMLElement) => {
    drawn.text = node.textContent ?? '';
    return Promise.resolve({
      width: 840,
      height: 1600,
      toDataURL: () => 'data:image/jpeg;base64,',
    });
  }),
}));

vi.mock('jspdf', () => ({
  jsPDF: class {
    addImage() {}
    save(name: string) {
      drawn.saved = name;
    }
  },
}));

const branch = testBranch();
const order = testOrderHistory().history.find((o) => o.id === 'A104') as Order;

function Invoice() {
  const invoice = useBillDownload({
    region: branch,
    money: createMoney(branch),
    clock: createClock(branch),
  });
  return (
    <>
      <button type="button" onClick={() => void invoice.download([order])}>
        Get invoice
      </button>
      {invoice.sheet}
    </>
  );
}

describe('useBillDownload', () => {
  it("saves the staff bill as a PDF: the branch, the order's items, charges and total", async () => {
    const { findByRole } = render(
      <ApiTestProvider>
        <Invoice />
      </ApiTestProvider>,
    );
    await act(async () => {
      fireEvent.click(await findByRole('button', { name: 'Get invoice' }));
    });
    await waitFor(() => expect(drawn.saved).toBe(`Bill ${order.id}.pdf`));
    expect(drawn.text).toContain(branch.shortName);
    expect(drawn.text).toContain(order.id);
    for (const item of order.items) expect(drawn.text).toContain(item.name);
    expect(drawn.text).toContain('CGST');
    expect(drawn.text).toContain(createMoney(branch).format(order.total));
    expect(drawn.saved).toBe(`Bill ${order.id}.pdf`);
    // Taken away once saved.
    expect(document.body.textContent).not.toContain('CGST');
  });
});
