import { expect, test, adminSignIn, againstBackend } from './helpers';

/**
 * Purchasing, start to finish, as admin staff use it (the server's only: the demo has none):
 * a new supplier and what they sell, an order from their card (no approval needed by default),
 * sent another way, its delivery checked in with one item refused at the door, the delivery's
 * badge, and one item sent back. The server keeps its data between tests, so each run uses a
 * supplier of its own.
 */

test.skip(!againstBackend, 'Purchasing needs the server.');

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('a supplier, an order, a delivery and a return', async ({ page }, info) => {
  const name = `Fresh Farm ${info.project.name} ${Date.now() % 100000}`;
  await adminSignIn(page);
  await page.goto('/admin/dashboard/purchasing/');
  await expect(page.getByRole('heading', { name: 'Purchasing', level: 1 })).toBeVisible();

  // A supplier: details, then straight on to what they sell.
  await page.getByRole('tab', { name: 'Suppliers' }).click();
  await page.getByRole('button', { name: 'New supplier' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Shop or company name').fill(name);
  await dialog.getByLabel(/^Phone/).fill('+919876500001');
  await dialog.getByRole('button', { name: 'Save and add what they sell' }).click();
  await expect(dialog.getByRole('tab', { name: /What they sell/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('button', { name: 'Add from my ingredients' }).click();
  await dialog.getByRole('checkbox', { name: /^Onion\b/ }).check();
  await dialog.getByRole('checkbox', { name: /^Tomato\b/ }).check();
  await dialog.getByRole('button', { name: 'Add 2 items' }).click();
  await dialog.getByLabel('Price per pack').nth(0).fill('40');
  await dialog.getByLabel('Price per pack').nth(1).fill('30');
  await dialog.getByRole('button', { name: 'Save what they sell' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();

  // An order from their card: how many of each, due tomorrow.
  const card = page.getByRole('article').filter({ hasText: name });
  await expect(card.getByText('2 items')).toBeVisible();
  await card.getByRole('button', { name: 'Order from them' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('How many of Onion').fill('5');
  await dialog.getByLabel('How many of Tomato').fill('3');
  await dialog.getByRole('button', { name: 'Tomorrow' }).click();
  await expect(dialog.getByText('About ₹')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save order', exact: true }).click();
  await expect(page.getByText(/PO-\d+ saved/)).toBeVisible();

  // No approval by default: ready to send. Sent another way, it's to receive.
  await page.getByRole('tab', { name: 'Orders' }).click();
  const order = page.getByRole('article').filter({ hasText: name });
  await expect(order.getByText('Ready to send')).toBeVisible();
  await order.getByRole('button', { name: new RegExp(name) }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'I sent it another way' }).click();
  await expect(page.getByText('Order marked as sent')).toBeVisible();
  await dialog.getByRole('button', { name: 'Receive delivery' }).click();

  // Checked in: everything came, but one tomato refused at the door, damaged.
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Everything came as ordered' }).click();
  await expect(dialog.getByText('2 of 2 items checked')).toBeVisible();
  await dialog
    .getByRole('listitem')
    .filter({ hasText: 'Tomato' })
    .getByRole('button', { name: 'Different' })
    .click();
  await dialog.getByLabel(/Refused at the door/).fill('1');
  await dialog.getByRole('button', { name: 'Damaged' }).click();
  await dialog.getByRole('button', { name: 'Save delivery' }).click();
  await expect(page.getByText(/GRN-\d+ saved/)).toBeVisible();

  // The delivery says so; one onion goes back, expired.
  await page.getByRole('tab', { name: 'Deliveries' }).click();
  const delivery = page.getByRole('button').filter({ hasText: name }).first();
  await expect(delivery.getByText('1 item refused')).toBeVisible();
  await delivery.click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Send items back' }).click();
  await dialog.getByRole('button', { name: 'One more Onion' }).click();
  await dialog.getByRole('button', { name: 'Expired' }).click();
  await dialog.getByRole('button', { name: 'Save return' }).click();
  await expect(page.getByText(/RTN-\d+ saved/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText(`Sent back to ${name}`)).toBeVisible();
});
