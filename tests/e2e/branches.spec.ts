import { expect, test, type Page } from '@playwright/test';
import { waitForSavedCart, scan } from './helpers';

/**
 * Branches and regions: a QR code for the Nepal branch (Thamel, Kathmandu) gives NPR prices,
 * a service charge + VAT bill, +977 mobile numbers, Nepali payment methods and Kathmandu
 * time. Runs at a mobile (390px) and a desktop (1280px) viewport — see playwright.config.ts.
 */

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

/** Intl puts a no-break space between "रू" and the amount. */
const npr = (amount: string) => new RegExp(`रू\\s${amount.replace('.', '\\.')}$`);

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=7');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  // A fresh guest at table 12 (without a QR code the start screen would open instead).
  await scan(page, 'table=12');
});

test('a Nepal QR code: NPR prices, service charge + VAT, +977 and Nepali payments', async ({
  page,
}) => {
  // Kathmandu is UTC+5:45: 14:00 UTC is 7:45 PM there (7:30 PM in India).
  await page.clock.setFixedTime(new Date('2026-10-03T14:00:00Z'));

  await scan(page, 'branch=ktm-thamel&table=5');
  await expect(visible(page, 'Table 5')).toBeVisible();
  await expect(visible(page, 'The Olive Table — Thamel')).toBeVisible();

  // The menu header names the branch and table; prices are in Nepali rupees.
  await page.goto('/menu/');
  await expect(visible(page, 'The Olive Table — Thamel')).toBeVisible();
  await expect(visible(page, 'Table 5')).toBeVisible();
  await page.goto('/menu/starters/');
  await expect(visible(page, npr('460'))).toBeVisible();
  await expect(page.getByText(/₹/).filter({ visible: true })).toHaveCount(0);
  await expect(async () => {
    const stepper = page.getByRole('group', { name: 'Quantity of Dahi Kebab' }).first();
    if (!(await stepper.isVisible())) {
      await page.getByRole('button', { name: 'Add Dahi Kebab' }).click({ timeout: 2000 });
    }
    await expect(stepper).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await waitForSavedCart(page, 'dahi-kebab');

  // रू 460 + 10% service (46.00) = 506 + 13% VAT (65.78) = 571.78 → रू 572
  await page.goto('/cart/');
  await expect(visible(page, 'Service charge (10%)')).toBeVisible();
  await expect(visible(page, npr('46.00'))).toBeVisible();
  await expect(visible(page, 'VAT (13%)')).toBeVisible();
  await expect(visible(page, npr('65.78'))).toBeVisible();
  await expect(visible(page, '+रू 0.22')).toBeVisible();
  await expect(visible(page, npr('572'))).toBeVisible();
  await expect(page.getByText(/GST|Not added/).filter({ visible: true })).toHaveCount(0);

  // Checkout: +977 numbers starting 97 or 98.
  await page.goto('/checkout/details/');
  await expect(visible(page, '+977')).toBeVisible();
  await page.getByLabel('Full name').fill('Asha Gurung');
  await page.getByLabel('Mobile number').fill('9612345678');
  await page.getByRole('button', { name: 'Send OTP' }).filter({ visible: true }).click();
  await expect(visible(page, 'Nepali mobile numbers start with 97 or 98')).toBeVisible();
  await page.getByLabel('Mobile number').fill('9841234567');
  await expect(page.getByLabel('Mobile number')).toHaveValue('984-1234567');
  await page.getByRole('button', { name: 'Send OTP' }).filter({ visible: true }).click();

  await expect(page).toHaveURL(/\/checkout\/verify\/$/);
  await expect(visible(page, '+977 984-1234567')).toBeVisible();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await page.getByRole('button', { name: 'Verify & continue' }).filter({ visible: true }).click();

  // Payment methods: eSewa (default), Khalti, Fonepay, card, counter — no UPI.
  await expect(page).toHaveURL(/\/checkout\/payment\/$/);
  await expect(page.getByRole('radio', { name: /eSewa/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /Khalti/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Fonepay/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Debit or credit card/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Pay at the counter/ })).toBeVisible();
  await expect(page.getByText(/UPI/).filter({ visible: true })).toHaveCount(0);
  await page
    .getByRole('button', { name: /^Pay रू/ })
    .filter({ visible: true })
    .click();

  await expect(page).toHaveURL(/\/checkout\/processing\/$/);
  await expect(visible(page, /Approve the request in your eSewa app/)).toBeVisible();
  await page.getByRole('button', { name: 'Prototype: success' }).filter({ visible: true }).click();

  // The order is timed in Kathmandu.
  await expect(page).toHaveURL(/\/order\/confirmed\/\?id=A\d+$/);
  await expect(visible(page, npr('572'))).toBeVisible();
  await page.goto(page.url().replace('/confirmed/', '/'));
  await expect(visible(page, /Today, 7:45 PM/)).toBeVisible();
  await expect(visible(page, 'eSewa')).toBeVisible();
});

test('Nepal: pay at the counter, then pay the bill with Khalti; the copy names Nepal’s ways to pay', async ({
  page,
}) => {
  test.slow();
  await scan(page, 'branch=ktm-thamel&table=5');
  await expect(visible(page, 'The Olive Table — Thamel')).toBeVisible();
  await page.goto('/menu/starters/');
  await expect(async () => {
    const stepper = page.getByRole('group', { name: 'Quantity of Dahi Kebab' }).first();
    if (!(await stepper.isVisible())) {
      await page.getByRole('button', { name: 'Add Dahi Kebab' }).click({ timeout: 2000 });
    }
    await expect(stepper).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await waitForSavedCart(page, 'dahi-kebab');

  await page.goto('/checkout/details/');
  await page.getByLabel('Full name').fill('Asha Gurung');
  await page.getByLabel('Mobile number').fill('9841234567');
  await page.getByRole('button', { name: 'Send OTP' }).filter({ visible: true }).click();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await page.getByRole('button', { name: 'Verify & continue' }).filter({ visible: true }).click();
  await page.getByRole('radio', { name: /Pay at the counter/ }).click();
  await page
    .getByRole('button', { name: /Place order/ })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/order\/confirmed\/\?id=A\d+$/);

  // The bill hint and the payment help name Nepal's ways to pay and its VAT invoice.
  await page.goto('/help/bill/');
  await expect(
    visible(page, 'You can pay by card, eSewa, Khalti, Fonepay QR or cash.'),
  ).toBeVisible();
  await page.goto('/help/');
  await page.getByRole('button', { name: /Payment help/ }).click();
  const help = page.getByRole('dialog', { name: 'Payment help' });
  await expect(
    help.getByText('Ask your server for a VAT invoice when you request the bill.'),
  ).toBeVisible();
  await expect(help.getByText(/UPI|GST/)).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Pay my bill with Khalti: रू 572, paid through the mock payment partner.
  await page.goto('/help/bill/pay/');
  await page.getByRole('radio', { name: /Khalti/ }).click();
  await page
    .getByRole('button', { name: /^Pay रू/ })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Confirming your payment' })).toBeVisible();
  await page.getByRole('button', { name: 'Prototype: success' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bill paid' })).toBeVisible();
  const receipt = page.getByRole('definition');
  await expect(receipt.filter({ hasText: npr('572') })).toBeVisible();
  await expect(receipt.filter({ hasText: 'Khalti' })).toBeVisible();
});

test('India stays the default branch, and another branch is another session', async ({ page }) => {
  await scan(page, 'branch=ktm-thamel&table=5');
  await expect(visible(page, 'The Olive Table — Thamel')).toBeVisible();

  // A plain table link is the default (India) branch: a new session with ₹ prices.
  await scan(page, 'table=5');
  await expect(visible(page, 'Table 5')).toBeVisible();
  await page.goto('/menu/starters/');
  await expect(visible(page, '₹289')).toBeVisible();
  await expect(page.getByText('The Olive Table — Thamel')).toHaveCount(0);
});
