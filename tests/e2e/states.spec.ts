import { readFileSync } from 'node:fs';
import { waitForSavedCart, scan } from './helpers';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Branch } from '../../src/types/branch';

/**
 * Restaurant states: closed (s01 · ws01), ordering paused (s02 · ws02) and offline (s03 · ws03).
 * Previewed with ?status=, which is remembered for the tab. Runs at 390px and 1280px.
 */

/** The default branch (India) in the dummy GET /branches the site is built with. */
const [restaurant] = JSON.parse(
  readFileSync(path.join(process.cwd(), 'public', 'api', 'branches.json'), 'utf8'),
) as Branch[];

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=7');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  // A fresh guest at table 12 (without a QR code the start screen would open instead).
  await scan(page, 'table=12');
});

test('closed: the menu stays browsable but read-only, and checkout is blocked', async ({
  page,
}) => {
  await page.goto('/?status=closed');
  await expect(
    page.getByRole('heading', { level: 1, name: "We're closed right now" }),
  ).toBeVisible();
  await expect(visible(page, 'Closed now')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call restaurant' })).toHaveAttribute(
    'href',
    /^tel:/,
  );

  await page.getByRole('link', { name: 'Browse the menu' }).click();
  await expect(page).toHaveURL(/\/menu\/$/);
  // The preview persists without the parameter.
  await expect(visible(page, /We're closed right now\. Ordering opens again/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Dahi Kebab' })).toHaveCount(0);
  // ADD is replaced by a disabled "Closed" label ("Dahi Kebab: Closed" for screen readers).
  await expect(visible(page, 'Dahi Kebab: Closed')).toBeVisible();

  await page.goto('/dish/truffle-mushroom-pasta/');
  await expect(page.getByRole('button', { name: /Closed now/ })).toBeDisabled();

  await page.goto('/checkout/details/');
  await expect(
    page.getByRole('heading', { level: 1, name: "We're closed right now" }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send OTP' })).toHaveCount(0);
});

test('paused: guests can keep building the cart, and checkout offers a waiter', async ({
  page,
}) => {
  await page.goto('/menu/?status=paused');
  await expect(visible(page, 'Ordering paused')).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Online ordering is paused for about 15 minutes' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Add Dahi Kebab' }).click();
  await expect(page.getByRole('group', { name: 'Quantity of Dahi Kebab' }).first()).toBeVisible();
  await waitForSavedCart(page, 'dahi-kebab');

  await page.goto('/cart/');
  await page.getByRole('link', { name: 'Checkout' }).filter({ visible: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Our kitchen needs a moment' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Call a waiter' }).click();
  await expect(page.getByRole('dialog', { name: 'Need assistance?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Need assistance?' })).toBeHidden();

  await page.getByRole('link', { name: 'Keep browsing' }).click();
  await expect(page).toHaveURL(/\/menu\/$/);

  // ?status=open ends the preview.
  await page.goto('/menu/?status=open');
  await expect(visible(page, `Open · until ${restaurant.closesAt}`)).toBeVisible();
  await expect(page.getByText('Online ordering is paused')).toHaveCount(0);
});

test('offline: a banner while browsing, and checkout waits for the connection', async ({
  page,
  context,
}) => {
  await page.goto('/menu/');
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeAttached();

  await context.setOffline(true);
  await expect(page.getByRole('alert').filter({ hasText: "You're offline" })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('alert').filter({ hasText: "You're offline" })).toHaveCount(0);

  await page.goto('/checkout/details/?status=offline');
  await expect(
    page.getByRole('heading', { level: 1, name: 'No internet connection' }),
  ).toBeVisible();
  await expect(visible(page, restaurant.wifiName)).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  // Back online: checkout takes over (an empty cart goes to /cart).
  await expect(page).toHaveURL(/\/cart\/$/);
});
