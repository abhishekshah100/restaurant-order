import { expect, test, type Page } from '@playwright/test';

/**
 * Admin sign-in (/admin/login/) against the mock server: field errors, the invalid-credentials
 * alert, and the mock-only demo account through to branch selection. Runs at 390px and 1280px.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const identity = (page: Page) => page.getByLabel('Email or mobile number');
const password = (page: Page) => page.getByLabel('Password', { exact: true });
const signIn = (page: Page) => page.getByRole('button', { name: 'Sign in', exact: true });

test('nothing is prefilled', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(identity(page)).toHaveValue('');
  await expect(password(page)).toHaveValue('');
});

test('an empty submit shows the field errors', async ({ page }) => {
  await signIn(page).click();
  await expect(page.getByText('Enter your email or mobile number.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();
  await expect(identity(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/isn't right/)).toHaveCount(0);
});

test('a wrong password shows the alert', async ({ page }) => {
  await identity(page).fill('abhishek@gmail.com');
  await password(page).fill('wrong');
  await signIn(page).click();
  await expect(page.getByRole('alert').filter({ hasText: /password isn.t right/ })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login\/$/);
});

test('the password toggle shows and hides the password', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Show password' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(password(page)).toHaveAttribute('type', 'text');
});

test('the demo account signs in and opens branch selection', async ({ page }) => {
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await expect(identity(page)).not.toHaveValue('');
  await expect(password(page)).not.toHaveValue('');
  await signIn(page).click();
  await expect(page).toHaveURL(/\/admin\/select-branch\/$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Udyog Vihar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thamel' })).toBeVisible();
});
