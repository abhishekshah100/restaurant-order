import { expect, test } from '@playwright/test';
import { addDish, adminSignIn, callWaiter, orderAtCounter, scan, visible } from './helpers';

/**
 * The floor plan (/admin/dashboard/tables/) and a table's page against the mock server, in the
 * same browser as a guest: the guest at table 5 orders at the counter and calls a waiter; the
 * admin opens Tables, sees table 5 on the ground floor needing a waiter, switches area (kept in
 * the address), opens table 5, clears the call with Done, opens the order with all its details,
 * and comes back to the same area.
 */

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=5');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('a table from the floor plan to its order', async ({ page }) => {
  test.slow();
  await scan(page, 'table=5');
  await addDish(page, 'starters', 'Dahi Kebab');
  const orderId = await orderAtCounter(page);
  await callWaiter(page);

  await adminSignIn(page);
  await visible(page, 'link', 'Tables').click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/tables\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Tables' })).toBeVisible();

  const ground = page.getByRole('tab', { name: /Ground floor/ });
  await expect(ground).toHaveAttribute('aria-selected', 'true');
  const tableFive = page.getByRole('link', { name: /^Table 5, 6 seats: Needs waiter$/ });
  await expect(tableFive).toBeVisible();
  await expect(page.getByRole('link', { name: /^Table 1, 2 seats: Available$/ })).toBeVisible();

  // Another area: its own tables, and the address keeps it.
  await page.getByRole('tab', { name: /First floor/ }).click();
  await expect(page).toHaveURL(/\?floor=first$/);
  await expect(page.getByRole('link', { name: /^Table 9,/ })).toBeVisible();
  await expect(tableFive).toHaveCount(0);
  await ground.click();

  await tableFive.click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/tables\/5\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Table 5' })).toBeVisible();
  await expect(page.getByText('Ground floor · 6 seats')).toBeVisible();

  const requests = page.getByRole('region', { name: 'Requests' });
  await expect(requests).toContainText('Needs water');
  await requests.getByRole('button', { name: 'Done: Needs water' }).click();
  await expect(requests).toHaveCount(0);
  await expect(page.getByText('Food on the way').first()).toBeVisible();

  await page.getByRole('button', { name: `Open order ${orderId}` }).click();
  const dialog = page.getByRole('dialog', { name: `Order ${orderId}` });
  await expect(dialog).toContainText('Ananya Rao · Table 5');
  await expect(dialog).toContainText('Dahi Kebab');
  await expect(dialog).toContainText('Still to pay');
  await expect(dialog).toContainText('Received');
  await dialog.getByRole('button', { name: /close/i }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('link', { name: 'All tables' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/tables\/\?floor=ground$/);
  await expect(
    page.getByRole('link', { name: /^Table 5, 6 seats: Food on the way$/ }),
  ).toBeVisible();
});
