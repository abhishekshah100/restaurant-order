import type { Page } from '@playwright/test';
import { expect, test, expectBranchOpen, visible } from './helpers';

/**
 * Admin branch picker (/admin/select-branch/), on the mock server or the backend: the demo admin manages
 * both demo branches, so signing in opens the picker; choosing one opens its dashboard and
 * marks it "Last used"; a closed branch can still be chosen; Sign out returns to the login.
 * Runs at 390px and 1280px. (One branch skips the picker: tests/unit/adminBranches.test.ts.)
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function signInWithDemo(page: Page) {
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/select-branch\/$/);
}

const card = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name }) });
const choose = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('signing in lists both branches; choosing Thamel opens its dashboard', async ({ page }) => {
  await signInWithDemo(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Choose a branch' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(card(page, 'Udyog Vihar')).toContainText('Gurgaon, India');
  await expect(card(page, 'Thamel')).toContainText('Kathmandu, Nepal');
  await expect(card(page, 'Thamel')).toContainText('NPR');
  await expect(card(page, 'Thamel')).toContainText(/Now \d{1,2}:\d{2} [AP]M/);
  // Few branches: no search field.
  await expect(page.getByRole('searchbox')).toHaveCount(0);

  await choose(page, 'Thamel').click();
  await expectBranchOpen(page, 'Thamel');

  // Back to the picker: Thamel comes first, marked "Last used".
  await page.goto('/admin/select-branch/');
  await expect(page.getByRole('article').first()).toContainText('Last used');
  await expect(page.getByRole('article').first().getByRole('heading')).toHaveText('Thamel');
  await expect(card(page, 'Udyog Vihar')).not.toContainText('Last used');
});

test('a closed branch can still be chosen', async ({ page }) => {
  // Staff close Thamel for the rest of today from its dashboard.
  await signInWithDemo(page);
  await choose(page, 'Thamel').click();
  await expectBranchOpen(page, 'Thamel');
  await visible(page, 'button', /^Branch status: Open/).click();
  const dialog = page.getByRole('dialog', { name: 'Taking orders?' });
  await dialog.getByRole('radio', { name: /Close for the rest of today/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(visible(page, 'button', /^Branch status: Closed/)).toBeVisible();

  await page.goto('/admin/select-branch/');
  await expect(card(page, 'Thamel')).toContainText('Closed');
  await expect(card(page, 'Udyog Vihar')).toContainText('Open');
  await choose(page, 'Thamel').click();
  await expectBranchOpen(page, 'Thamel');
});

test('the whole card is the target', async ({ page }) => {
  await signInWithDemo(page);
  // Click the card's details, not its name.
  await card(page, 'Udyog Vihar').click({ position: { x: 24, y: 110 } });
  await expect(page).toHaveURL(/\/admin\/dashboard\/$/);
});

test('sign out returns to the login page', async ({ page }) => {
  await signInWithDemo(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login\/$/);
  await page.goto('/admin/select-branch/');
  await expect(page).toHaveURL(/\/admin\/login\/$/);
});

test('without a session the picker sends the admin to sign in', async ({ page }) => {
  await page.goto('/admin/select-branch/');
  await expect(page).toHaveURL(/\/admin\/login\/$/);
});
