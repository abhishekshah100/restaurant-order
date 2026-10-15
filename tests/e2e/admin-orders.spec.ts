import { expect, test } from '@playwright/test';
import { addDish, adminSignIn, orderAtCounter, scan, visible } from './helpers';

/**
 * The Orders page against the mock server, in the same browser as a guest: the guest at table
 * 5 orders at the counter; staff find it under Active by searching its number, open it, collect
 * the payment in cash, then cancel it because an item ran out — it moves to Cancelled, and the
 * guest's order page shows the reason.
 */

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=5');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('an order from Active to paid to cancelled, as the guest sees it', async ({ page }) => {
  test.slow();
  await scan(page, 'table=5');
  await addDish(page, 'starters', 'Dahi Kebab');
  const orderId = await orderAtCounter(page);

  await adminSignIn(page);
  await visible(page, 'link', 'Orders').click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/orders\/$/);
  await expect(page.getByRole('button', { name: /^Active/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('searchbox', { name: 'Search order, guest or table' }).fill(orderId);
  const row = page.getByRole('listitem').filter({ hasText: `Order ${orderId}` });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Ananya Rao');
  await expect(row).toContainText('1 × Dahi Kebab');

  await row.getByRole('button', { name: `Open order ${orderId}` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(`Order ${orderId}`);
  await dialog.getByRole('button', { name: /^Collect payment/ }).click();
  await dialog.getByRole('radio', { name: 'Cash' }).click();
  await dialog.getByRole('button', { name: /^Collect / }).click();
  await expect(page.getByRole('status').filter({ hasText: `Order ${orderId} paid` })).toBeVisible();
  await expect(row).toContainText('paid');

  await row.getByRole('button', { name: `Open order ${orderId}` }).click();
  await expect(dialog).toContainText('Cash · paid');
  await dialog.getByRole('button', { name: /^Cancel order/ }).click();
  await dialog.getByRole('radio', { name: 'An item ran out' }).click();
  await dialog.getByRole('button', { name: /^Cancel order$/ }).click();
  await expect(
    page.getByRole('status').filter({ hasText: `Order ${orderId} cancelled` }),
  ).toBeVisible();

  // Gone from Active; under Cancelled (kept in the address).
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: /^Cancelled/ }).click();
  await expect(page).toHaveURL(/\?view=cancelled$/);
  await expect(page.getByRole('listitem').filter({ hasText: `Order ${orderId}` })).toBeVisible();

  await page.goto(`/order/?id=${orderId}`);
  await expect(page.getByText('An item ran out in the kitchen').first()).toBeVisible();
});
