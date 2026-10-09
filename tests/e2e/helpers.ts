import { expect, type Page } from '@playwright/test';

/**
 * Waits until the cart holding this dish is saved on the device. A new guest session is opened
 * by the server (POST /sessions, a few hundred ms with the mock), and the cart is saved once
 * it's there; a full page load before that would start over.
 */
export async function waitForSavedCart(page: Page, dishSlug: string) {
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('olive.cart.v2') ?? ''))
    .toContain(`"dishSlug":"${dishSlug}"`);
}

/** The menu slug of a dish name as these tests use them: "Hara Bhara Kebab" → "hara-bhara-kebab". */
export const dishSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

/**
 * Opens a table QR link (`scan(page, 'table=12')`, `scan(page, 'branch=ktm-thamel&table=5')`)
 * and waits until its guest session is saved, so the next page load goes on with it (without a
 * session, pages send the guest to the start screen).
 */
export async function scan(page: Page, query: string) {
  await page.goto(`/?${query}`);
  const table = new URLSearchParams(query).get('table');
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('olive.session.v1') ?? ''))
    .toContain(`"table":${table}`);
}
