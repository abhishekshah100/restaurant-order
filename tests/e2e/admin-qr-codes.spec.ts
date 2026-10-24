import { expect, test, adminSignIn, scan } from './helpers';

/**
 * Table QR codes: from Tables to a card per table with its full link, two selected and printed
 * (only they are on the printed page, without the link), one downloaded as a PNG with the
 * restaurant and the table above the code, and one table's code from its page.
 */

test('printing and downloading table QR codes', async ({ page }) => {
  test.slow();
  await scan(page, 'table=5');
  await adminSignIn(page);
  await page.goto('/admin/dashboard/tables/');
  await page.getByRole('link', { name: 'QR codes' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/tables\/qr\/$/);
  await expect(page.getByRole('img', { name: 'QR code for Table 18' })).toBeVisible();
  // On screen, the full link under each code.
  await expect(page.getByLabel('Link for Table 5')).toHaveText(
    /^http:\/\/localhost:\d+\/\?.*table=5/,
  );

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
  await expect(sheet).not.toContainText('http');

  await page.emulateMedia({ media: 'screen' });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download the QR code for Table 5' }).click();
  const png = await download;
  expect(png.suggestedFilename()).toBe('udyog-vihar-table-5-qr.png');
  // The restaurant and the table are drawn above the code: taller than wide.
  const file = await png.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of file) chunks.push(chunk as Buffer);
  const header = Buffer.concat(chunks);
  expect(header.readUInt32BE(20)).toBeGreaterThan(header.readUInt32BE(16));

  await page.goto('/admin/dashboard/tables/view/?table=5');
  await page.getByRole('button', { name: 'QR code' }).click();
  const dialog = page.getByRole('dialog', { name: 'QR code for Table 5' });
  await expect(dialog.getByRole('img', { name: 'QR code for Table 5' })).toBeVisible();
  await expect(dialog).toContainText('Scan to order & pay');
  await expect(dialog.getByLabel('Link for Table 5')).toBeVisible();
});
