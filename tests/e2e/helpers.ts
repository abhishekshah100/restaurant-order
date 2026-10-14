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

/** The first visible element with this role and name (mobile and desktop render both). */
export const visible = (
  page: Page,
  role: Parameters<Page['getByRole']>[0],
  name: string | RegExp,
) => page.getByRole(role, { name }).filter({ visible: true }).first();

/** Adds a dish from its category page and waits for the cart to be saved. */
export async function addDish(page: Page, category: string, dish: string) {
  await page.goto(`/menu/${category}/`);
  const stepper = page.getByRole('group', { name: `Quantity of ${dish}` }).first();
  await expect(async () => {
    if (!(await stepper.isVisible())) {
      await page.getByRole('button', { name: `Add ${dish}` }).click({ timeout: 2000 });
    }
    await expect(stepper).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await waitForSavedCart(page, dishSlug(dish));
}

/** Places the cart at the counter; returns the order number. */
export async function orderAtCounter(page: Page): Promise<string> {
  await page.goto('/checkout/details/');
  await page.getByLabel('Full name').fill('Ananya Rao');
  await page.getByLabel('Mobile number').fill('9876543210');
  await visible(page, 'button', 'Send OTP').click();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await visible(page, 'button', 'Verify & continue').click();
  await page.getByRole('radio', { name: /Pay at the counter/ }).click();
  await visible(page, 'button', /^Place order/).click();
  await expect(page).toHaveURL(/\/order\/confirmed\/\?id=A\d+$/);
  return new URL(page.url()).searchParams.get('id') ?? '';
}

/** Calls a waiter from Help: needs water, with a note. */
export async function callWaiter(page: Page) {
  await page.goto('/help/');
  await visible(page, 'button', /Call (a )?waiter/).click();
  const dialog = page.getByRole('dialog', { name: 'Need assistance?' });
  await dialog.getByRole('radio', { name: 'Need water' }).click();
  await dialog.getByLabel(/Add a note/).fill('No ice, please');
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL(/\/help\/waiter-requested\/$/);
}

/** Signs in with the demo admin and picks a branch. */
export async function adminSignIn(page: Page, branch = 'Indiranagar') {
  await page.goto('/admin/login/');
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/select-branch\/$/);
  await page.getByRole('button', { name: branch, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/$/);
}

/**
 * The staff pages are open on this branch: its short name in the shell (the sidebar from
 * 1024px, the app bar below).
 */
export async function expectBranchOpen(page: Page, shortName: string) {
  await expect(page).toHaveURL(/\/admin\/dashboard\/$/);
  await expect(
    page.getByText(shortName, { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
}
