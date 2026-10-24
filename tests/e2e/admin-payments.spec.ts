import type { Page } from '@playwright/test';
import { expect, test, addDish, adminSignIn, orderAtCounter, scan } from './helpers';

/**
 * The Payments page against the mock server, in the same browser as the guests: guests at
 * tables 5 and 9 order at the counter. Staff see both under To collect; split table 5's bill
 * two ways (half in cash with a tip and change, the rest by card); find the payments under
 * Transactions; refund part of it for a wrong item (under Refunds); print the day report; and
 * export the day as CSV.
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

test('collect a split bill with a tip, find it, refund part of it, report and export', async ({
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
  await expect(page.getByRole('button', { name: /^To collect/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const five = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Table 5' }) });
  await expect(five).toContainText(atFive);
  await expect(
    page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Table 9' }) }),
  ).toContainText(atNine);

  // Split two ways: the first half in cash with a 10% tip, handed over exactly.
  await five.getByRole('button', { name: 'Collect' }).click();
  const collect = page.getByRole('dialog', { name: 'Collect payment' });
  await expect(collect).toContainText(`#${atFive} · Ananya Rao`);
  await collect.getByRole('radio', { name: 'Split evenly' }).check();
  await expect(collect).toContainText(/Each pays ₹\d+/);
  await collect.getByRole('radio', { name: 'Cash' }).check();
  await collect.getByRole('radio', { name: /^10%/ }).check();
  await collect.getByRole('button', { name: 'Exact' }).click();
  await expect(collect.getByRole('status').filter({ hasText: 'Change to give' })).toContainText(
    '₹0',
  );
  await collect.getByRole('button', { name: /^Collect ₹[\d.,]+ \+ ₹[\d.,]+ tip$/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /still due/ })).toBeVisible();

  // The rest by card: the bill is settled and table 5 leaves To collect.
  await expect(collect.getByRole('radio', { name: 'Full bill' })).toBeChecked();
  await collect.getByRole('radio', { name: 'Card' }).check();
  await collect.getByRole('button', { name: /^Collect ₹/ }).click();
  await expect(
    page.getByRole('status').filter({ hasText: `collected for order #${atFive}` }),
  ).toBeVisible();
  await expect(collect).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Table 5' })).toHaveCount(0);

  // Transactions: both payments on the order, the cash one with its tip and who took it.
  await page.getByRole('button', { name: /^Transactions/ }).click();
  await expect(page).toHaveURL(/\?view=transactions$/);
  await page.getByRole('searchbox').fill(atFive);
  const rows = page.getByRole('button', {
    name: new RegExp(`^Payment of ₹[\\d.,]+ on order ${atFive}$`),
  });
  await expect(rows).toHaveCount(2);
  await page.getByRole('group', { name: 'Method' }).getByRole('button', { name: 'Cash' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(/\+₹[\d.,]+ tip/);
  await expect(rows).toContainText('by Abhishek Saha');

  // Refund part of it for a wrong item: back in cash, now.
  await rows.click();
  const order = page.getByRole('dialog', { name: `Order #${atFive}` });
  await expect(order).toContainText('Payments on this order');
  await order.getByRole('button', { name: 'Refund' }).click();
  const refund = page.getByRole('dialog', { name: `Refund order #${atFive}` });
  await refund.getByRole('radio', { name: 'Part of it' }).check();
  await refund.getByLabel('Amount to refund').fill('50');
  await refund.getByRole('radio', { name: 'Wrong item' }).check();
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
  await expect(refunded).toContainText('Refunded');
  // With the day's other refunds (a cancelled order's, still on its way).
  await expect(page.getByRole('region', { name: 'Refunds' })).toContainText(
    /₹[\d,]+ refunded today/,
  );

  // The day report goes to the printer with today's money in it.
  await page.getByRole('button', { name: 'Day report' }).click();
  const sheet = page.locator('[data-print-sheet]');
  await expect(sheet).toContainText('Day report');
  await expect(sheet).toContainText('Cash in the drawer');
  await expect(sheet).toContainText(`#${atNine}`);

  // The day as CSV.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^payments-blr-indiranagar-\d{4}-\d{2}-\d{2}\.csv$/);
});
