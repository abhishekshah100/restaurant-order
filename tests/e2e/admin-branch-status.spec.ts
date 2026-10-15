import { expect, test } from '@playwright/test';
import { adminSignIn, scan, visible } from './helpers';

/**
 * The branch's status from the admin bar, in the same browser as a guest: staff pause new
 * orders for 15 minutes (the guest's menu then says ordering is paused), close for the rest of
 * today (the guest's page says it opens again tomorrow), and open again.
 */

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=5');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('pause, close for today and open again, as guests see it', async ({ page }) => {
  test.slow();
  await scan(page, 'table=5');
  await adminSignIn(page);

  const status = visible(page, 'button', /^Branch status: Open/);
  await status.click();
  const dialog = page.getByRole('dialog', { name: 'Taking orders?' });
  await expect(dialog).toContainText('Indiranagar is open');
  await dialog.getByRole('radio', { name: /Pause new orders/ }).click();
  await dialog.getByRole('button', { name: '15 min' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'New orders paused for 15 min' }),
  ).toBeVisible();
  await expect(visible(page, 'button', /^Branch status: Paused/)).toBeVisible();

  await page.goto('/menu/');
  await expect(page.getByText(/ordering is paused for about 15 minutes/i).first()).toBeVisible();

  await page.goto('/admin/dashboard/');
  await visible(page, 'button', /^Branch status: Paused/).click();
  await expect(dialog).toContainText(/Indiranagar is paused until/);
  await dialog.getByRole('radio', { name: /Close for the rest of today/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(visible(page, 'button', /^Branch status: Closed/)).toBeVisible();

  await page.goto('/menu/');
  await expect(page.getByText(/opens again at .* tomorrow/i).first()).toBeVisible();

  await page.goto('/admin/dashboard/');
  await visible(page, 'button', /^Branch status: Closed/).click();
  await dialog.getByRole('radio', { name: /^Open/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Indiranagar is open again' }),
  ).toBeVisible();
  await page.goto('/menu/');
  await expect(page.getByText(/paused|closed for the rest/i)).toHaveCount(0);
});
