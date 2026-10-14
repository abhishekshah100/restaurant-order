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
  await expect(page.getByRole('heading', { level: 1, name: 'Tables' })).toHaveCount(1);

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

test('a waiter takes an order at a free table, then adds to it', async ({ page }) => {
  test.slow();
  await adminSignIn(page);
  await page.goto('/admin/dashboard/tables/6/');
  await expect(page.getByRole('heading', { level: 1, name: 'Table 6' })).toBeVisible();
  await page.getByRole('button', { name: 'Take order' }).click();

  await expect(page.getByRole('dialog', { name: 'New order · Table 6' })).toBeVisible();
  // Its heading names the dish while its choices are open.
  const pad = page.getByRole('dialog');
  // A dish without choices: one tap, then a stepper.
  await pad.getByRole('button', { name: 'Add Dahi Kebab' }).click();
  await expect(pad.getByRole('group', { name: 'Quantity of Dahi Kebab' })).toBeVisible();
  // A dish with choices: its sizes and spice level first.
  await pad.getByRole('button', { name: 'Choose options for Paneer Tikka' }).click();
  await pad.getByRole('radio', { name: /Full/ }).click();
  await pad.getByRole('button', { name: /^Add to order/ }).click();
  await expect(pad.getByText('1 added')).toBeVisible();

  await pad.getByRole('button', { name: /^Review order/ }).click();
  await pad.getByLabel(/Guest name/).fill('Mr Rao');
  await pad.getByLabel(/Note for the kitchen/).fill('Not too spicy');
  await pad.getByRole('button', { name: /^Send to kitchen/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /sent to the kitchen/ })).toBeVisible();
  await expect(pad).toHaveCount(0);

  const card = page.getByRole('article').filter({ hasText: 'Mr Rao' });
  await expect(card).toContainText('1 × Dahi Kebab, 1 × Paneer Tikka');
  await expect(page.getByRole('button', { name: 'New order' })).toBeVisible();

  // Later: more for the same guest, on the same bill.
  await card.getByRole('button', { name: /^Add items to order/ }).click();
  const more = page.getByRole('dialog', { name: /^Add to order A\d+$/ });
  await expect(more).toBeVisible();
  await expect(more).toContainText('Mr Rao · Table 6');
  await more.getByRole('button', { name: 'Add Dahi Kebab' }).click();
  await more.getByRole('button', { name: /^Review order/ }).click();
  await more.getByRole('button', { name: /^Send to kitchen/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Added to order A\d+$/ })).toBeVisible();

  await card.getByRole('button', { name: /^Open order/ }).click();
  const details = page.getByRole('dialog', { name: /^Order A\d+$/ });
  await expect(details).toContainText('Round 2');
  await expect(details).toContainText('Taken by Abhishek Saha');
  await expect(details).toContainText('Kitchen note: Not too spicy');
});
