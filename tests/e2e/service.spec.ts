import { expect, test, type Page } from '@playwright/test';

/**
 * Service: help page, request a waiter (with duplicate guard and cancel), request the bill.
 * Runs at a mobile (390px) and a desktop (1280px) viewport — see playwright.config.ts.
 * Table 12 has the mock orders #A104, #A097 and #A101 today. They belong to the table, not to
 * this fresh guest session, so "my order" links lead to My orders until the guest orders.
 */

const visible = (page: Page, role: Parameters<Page['getByRole']>[0], name: string | RegExp) =>
  page.getByRole(role, { name }).filter({ visible: true }).first();

/** The "Balance due" row (term + amount) of the visible bill summary. */
const balanceDue = (page: Page) =>
  page.getByText('Balance due', { exact: true }).filter({ visible: true }).first().locator('..');

test.beforeEach(async ({ page }) => {
  await page.goto('/?table=12');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/?table=12');
  await expect(page.getByText('Table 12').filter({ visible: true }).first()).toBeVisible();
});

test('request a waiter, see it pending, then cancel it', async ({ page }) => {
  await page.goto('/help/');
  await expect(page.getByRole('heading', { level: 1, name: 'How can we help?' })).toBeVisible();

  // "Follow us": each social profile opens safely in a new tab.
  await expect(
    page.getByRole('heading', { name: /^Follow (us|The Olive Table)$/ }).filter({ visible: true }),
  ).toBeVisible();
  for (const network of ['Instagram', 'Facebook', 'YouTube', 'X']) {
    const link = page.getByRole('link', { name: `${network} (opens in a new tab)` });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }

  await visible(page, 'button', /Call (a )?waiter/).click();
  const dialog = page.getByRole('dialog', { name: 'Need assistance?' });
  await expect(dialog).toBeVisible();

  // Single-select tiles with arrow keys.
  const callWaiter = dialog.getByRole('radio', { name: 'Call waiter' });
  await expect(callWaiter).toHaveAttribute('aria-checked', 'true');
  await callWaiter.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('radio', { name: 'Need water' })).toBeFocused();
  await expect(dialog.getByRole('radio', { name: 'Need water' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(callWaiter).toHaveAttribute('aria-checked', 'false');

  await dialog.getByLabel(/Add a note/).fill('A high chair, please');
  await dialog.getByRole('button', { name: 'Send request' }).click();

  await expect(page).toHaveURL(/\/help\/waiter-requested\/$/);
  await expect(page.getByRole('heading', { level: 1, name: "Someone's on the way" })).toBeVisible();
  await expect(page.getByText('Need water', { exact: true })).toBeVisible();
  await expect(page.getByText('“A high chair, please”')).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Request sent to the team at Table 12' }),
  ).toBeVisible();
  // This guest hasn't ordered yet, so there's no order of theirs to link to.
  await expect(page.getByRole('link', { name: 'View my order' })).toHaveCount(0);

  // A second request while one is pending shows the existing one.
  await page.goto('/help/');
  await expect(page.getByText(/Requested \d/).filter({ visible: true })).toBeVisible();
  await visible(page, 'button', /Call (a )?waiter/).click();
  await expect(page).toHaveURL(/\/help\/waiter-requested\/$/);
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', { name: 'Cancel request' }).click();
  await expect(page).toHaveURL(/\/help\/$/);
  await expect(page.getByRole('status').filter({ hasText: 'Request cancelled' })).toBeVisible();
});

test('request the bill for the whole table', async ({ page }) => {
  await page.goto('/help/');
  await visible(page, 'button', /Request (the )?bill/).click();
  await expect(page).toHaveURL(/\/help\/bill\/$/);

  // A guest who hasn't ordered yet has no bill of their own; the table's bill is available.
  await expect(visible(page, 'heading', 'Table 12 · 3 orders')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Whole table/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('radio', { name: /Just my orders/ })).toBeDisabled();
  await expect(balanceDue(page)).toContainText('₹1,074');

  await visible(page, 'button', 'Confirm bill request').click();
  await expect(page).toHaveURL(/\/help\/bill-requested\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Bill requested' })).toBeVisible();
  await expect(balanceDue(page)).toContainText('₹1,074');

  // The bill page now points to the pending request instead of asking again.
  await page.goto('/help/bill/');
  await expect(page.getByText(/You asked for the bill at/)).toBeVisible();
  await expect(visible(page, 'link', 'View bill request')).toBeVisible();
});

test('more help topics open in a dialog', async ({ page }) => {
  await page.goto('/help/');
  await expect(page.getByRole('link', { name: /Call the restaurant/ })).toHaveAttribute(
    'href',
    /^tel:/,
  );
  await expect(page.getByRole('link', { name: /Problem with my order/ })).toHaveAttribute(
    'href',
    '/orders/',
  );
  await page.getByRole('button', { name: /Allergens & FAQs/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Allergens & FAQs' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Wi-Fi')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
