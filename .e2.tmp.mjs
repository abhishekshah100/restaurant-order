import { chromium } from '@playwright/test';
const out = process.argv[2];
const base = 'http://localhost:3001';
const browser = await chromium.launch({ channel: 'chrome' });
for (const [name, width, height] of [['desktop', 1280, 1000], ['mobile', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(`${base}/admin/login/`);
  await page.getByLabel(/email/i).fill('abhishek@gmail.com');
  await page.getByLabel(/password/i).first().fill('Restaurant@#123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/select-branch|dashboard/, { timeout: 60000 });
  if (page.url().includes('select-branch')) { await page.getByText(/Indiranagar/).first().click(); await page.waitForURL(/dashboard/); }
  await page.goto(`${base}/admin/dashboard/menu/`);
  await page.getByRole('button', { name: /^Add dish/ }).waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Pizza', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Edit Wood-fired Margherita' }).click();
  await page.waitForTimeout(700);
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Add-ons', { exact: true }).click();
  await dialog.getByText('Add-ons', { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/e-${name}-4.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if (name === 'mobile') {
    await page.getByRole('button', { name: 'Edit Wood-fired Margherita' }).click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/e-${name}-2.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  await page.getByRole('button', { name: /^Reorder/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/e-${name}-6.png` });
  await page.getByRole('button', { name: /^Cancel/ }).click();
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/e-${name}-5.png` });
  await page.close();
}
await browser.close();
