import type { Page } from '@playwright/test';
import { expect, test, addDish, adminSignIn, orderAtCounter, scan } from './helpers';

/**
 * The Payments page against the mock server, in the same browser as the guests: guests at
 * tables 5 and 9 order at the counter. Staff see both under To collect; collect table 5's bill
 * in cash (its GST on the bill, the cash handed over and the change to return); find the payment
 * under Transactions; refund part of it for a wrong item, naming the dish (under Refunds); print
 * the day report; and export the day as CSV.
 */

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=5');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

async function orderAt(page: Page, table: number) {
  await scan(page, `table=${table}`);
  await addDish(page, 'starters', 'Dahi Kebab');
  return orderAtCounter(page);
}

test('collect a bill in cash with change, find it, refund part of it, report and export', async ({
  page,
}) => {
  test.slow();
  const atFive = await orderAt(page, 5);
  await page.evaluate(() => localStorage.removeItem('olive.session.v1'));
  const atNine = await orderAt(page, 9);

  await adminSignIn(page);
  // The browser's print dialog would block the test: printing only puts the page in the document.
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await page.goto('/admin/dashboard/payments/');

  // To collect: both tables, with what's due.
  // The view's chip ("To collect 3"), not the day strip's total.
  await expect(page.getByRole('button', { name: /^To collect \d+$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Each bill is a row led by its table, order and guest ("Table 5 #A105 · Ananya Rao").
  const row = (table: number) =>
    page
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: new RegExp(`^Table ${table} #`) }) });
  const five = row(5);
  await expect(five).toContainText(atFive);
  await expect(row(9)).toContainText(atNine);

  // The bill with every charge on it, then cash: a round note handed over, and the change.
  await five.getByRole('button', { name: 'Collect' }).click();
  const collect = page.getByRole('dialog', { name: 'Collect payment' });
  await expect(collect).toContainText(`#${atFive} · Ananya Rao`);
  // The bill's lines fold away under View bill.
  await collect.getByRole('button', { name: /View bill/ }).click();
  await expect(collect).toContainText('CGST (2.5%)');
  await expect(collect).toContainText('SGST (2.5%)');
  await collect.getByRole('radio', { name: 'Cash' }).check();
  await collect.getByRole('textbox', { name: 'Cash received' }).fill('2000');
  await expect(collect.getByRole('status').filter({ hasText: 'Change to return' })).toContainText(
    /₹[\d,]+/,
  );
  await collect.getByRole('textbox', { name: 'Cash received' }).fill('1');
  await expect(collect).toContainText(/short/);
  await expect(collect.getByRole('button', { name: /^Collect ₹/ })).toBeDisabled();
  await collect.getByRole('button', { name: 'Exact' }).click();
  await collect.getByRole('button', { name: /^Collect ₹/ }).click();
  await expect(
    page.getByRole('status').filter({ hasText: `collected for order #${atFive}` }),
  ).toBeVisible();
  await expect(collect).toBeHidden();
  await expect(five).toHaveCount(0);

  // Transactions: the cash payment on the order, and who took it.
  await page.getByRole('button', { name: /^Transactions/ }).click();
  await expect(page).toHaveURL(/\?view=transactions$/);
  await page.getByRole('searchbox').fill(atFive);
  const rows = page.getByRole('button', {
    name: new RegExp(`^Payment of ₹[\\d.,]+ on order ${atFive}$`),
  });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Cash');
  await expect(rows).toContainText('by Abhishek Saha');

  // Refund part of it for a wrong item, naming the dish: back in cash, now.
  await rows.click();
  const order = page.getByRole('dialog', { name: `Order #${atFive}` });
  await expect(order).toContainText('Payments on this order');
  await order.getByRole('button', { name: 'Refund' }).click();
  const refund = page.getByRole('dialog', { name: `Refund order #${atFive}` });
  await refund.getByRole('radio', { name: 'Wrong item' }).check();
  // A wrong item names its dish first.
  await expect(refund).toContainText('Pick the dishes this refund is for.');
  await expect(refund.getByRole('button', { name: /^Refund ₹/ })).toBeDisabled();
  await refund.getByRole('button', { name: 'Add one Dahi Kebab' }).click();
  await expect(
    refund.getByRole('radio', { name: /^For these dishes \(₹[\d,.]+\)$/ }),
  ).toBeVisible();
  await refund.getByRole('radio', { name: 'Part of it' }).check();
  await refund.getByLabel('Amount to refund').fill('50');
  await refund.getByLabel(/Note/).fill('Cold naan');
  await expect(refund).toContainText('Hand ₹50 back to the guest in cash now.');
  await refund.getByRole('button', { name: 'Refund ₹50' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: `₹50 refunded on order #${atFive}` }),
  ).toBeVisible();

  // Refunds: the one just given, done.
  await page.getByRole('button', { name: /^Refunds/ }).click();
  await page.getByRole('searchbox').fill('');
  const refunded = page.getByRole('button', { name: `Refund of ₹50 on order ${atFive}` });
  await expect(refunded).toContainText('Wrong item — Cold naan');
  await expect(refunded).toContainText('For: 1× Dahi Kebab');
  await expect(refunded).toContainText('Refunded');
  // With the day's other refunds (a cancelled order's, still on its way).
  await expect(page.getByRole('region', { name: 'Refunds' })).toContainText(
    /₹[\d,]+ refunded today/,
  );

  // The day report goes to the printer with today's money in it.
  await page.getByRole('button', { name: 'Day report' }).click();
  const sheet = page.locator('[data-print-sheet]');
  await expect(sheet).toContainText('Day report');
  await expect(sheet).toContainText('Cash taken');
  await expect(sheet).toContainText(`#${atNine}`);

  // The day as an Excel file.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export to Excel' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^payments-blr-indiranagar-\d{4}-\d{2}-\d{2}\.xlsx$/);
});
