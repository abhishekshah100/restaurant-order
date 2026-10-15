import { expect, test } from '@playwright/test';
import { adminSignIn, scan } from './helpers';

/**
 * Table QR codes: from Tables to a card per table, two selected and printed (only they are on
 * the printed page), one downloaded as a PNG, and one table's code from its page.
 */

test('printing and downloading table QR codes', async ({ page }) => {
  test.slow();
  await scan(page, 'table=5');
  await adminSignIn(page);
  await page.goto('/admin/dashboard/tables/');
  await page.getByRole('link', { name: 'QR codes' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/tables\/qr\/$/);
  await expect(page.getByRole('img', { name: 'QR code for Table 18' })).toBeVisible();

  await page.getByRole('button', { name: 'First floor', exact: true }).click();
  await expect(page.getByRole('img', { name: 'QR code for Table 1', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'All floors' }).click();
  await page.getByRole('checkbox', { name: 'Select Table 2' }).check();
  await page.getByRole('checkbox', { name: 'Select Table 5' }).check();

  // Print: the browser's dialog is stubbed; the sheet holds just the two cards.
  await page.evaluate(() => {
    window.print = () => window.dispatchEvent(new Event('printed'));
  });
  const printed = page.evaluate(
    () => new Promise((resolve) => window.addEventListener('printed', resolve, { once: true })),
  );
  await page.getByRole('button', { name: 'Print 2 codes' }).click();
  await printed;
  // Shown only when printing.
  await page.emulateMedia({ media: 'print' });
  const sheet = page.locator('[data-print-sheet]');
  await expect(sheet.getByRole('img')).toHaveCount(2);
  await expect(sheet).toContainText('Table 2');
  await expect(sheet).toContainText('Table 5');

  await page.emulateMedia({ media: 'screen' });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download the QR code for Table 5' }).click();
  expect((await download).suggestedFilename()).toBe('table-5-qr.png');

  await page.goto('/admin/dashboard/tables/5/');
  await page.getByRole('button', { name: 'QR code' }).click();
  const dialog = page.getByRole('dialog', { name: 'QR code for Table 5' });
  await expect(dialog.getByRole('img', { name: 'QR code for Table 5' })).toBeVisible();
  await expect(dialog).toContainText('Scan to order & pay');
});
