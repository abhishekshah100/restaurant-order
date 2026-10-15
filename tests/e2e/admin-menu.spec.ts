import { expect, test } from '@playwright/test';
import { adminSignIn, scan } from './helpers';

/**
 * The Menu page against the mock server, in the same browser as a guest: staff mark Dahi Kebab
 * sold out until a time (the guest's menu then says when it's back, and it can't be added),
 * put it back with the switch, and add a dish with two sizes that guests then find on the menu.
 */

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=5');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('sold out, back on, and a new dish, as guests see them', async ({ page }) => {
  test.slow();
  await scan(page, 'table=5');
  await adminSignIn(page);
  await page.goto('/admin/dashboard/menu/');

  // Sold out until a time.
  await page.getByRole('switch', { name: 'Dahi Kebab on the menu' }).click();
  const dialog = page.getByRole('dialog', { name: 'Dahi Kebab' });
  await dialog.getByRole('radio', { name: /Sold out until/ }).click();
  const time =
    (await dialog
      .getByRole('group', { name: 'Back at' })
      .getByRole('button')
      .first()
      .textContent()) ?? '';
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: `Dahi Kebab is sold out until ${time}` }),
  ).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Dahi Kebab on the menu' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(
    page.getByRole('button', { name: 'Change availability of Dahi Kebab' }),
  ).toContainText(`back ${time}`);

  // The guest's menu says so, and it can't be added; its page says when it's back.
  await page.goto('/menu/starters/');
  const row = page.getByRole('listitem').filter({ hasText: 'Dahi Kebab' }).first();
  await expect(row).toContainText(/sold out/i);
  await expect(page.getByRole('button', { name: 'Add Dahi Kebab' })).toHaveCount(0);
  await page.goto('/dish/dahi-kebab/');
  await expect(page.getByText(new RegExp(`back ${time}`, 'i')).first()).toBeVisible();

  // Back on with one tap.
  await page.goto('/admin/dashboard/menu/');
  await page.getByRole('switch', { name: 'Dahi Kebab on the menu' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Dahi Kebab is back on the menu' }),
  ).toBeVisible();

  // A new dish with two sizes.
  await page.getByRole('button', { name: /^Add dish/ }).click();
  const editor = page.getByRole('dialog', { name: 'Add a dish' });
  await editor.getByLabel('Dish name').fill('Masala Dosa');
  await editor.getByLabel(/Short description/).fill('Crisp rice crêpe, potato masala, chutneys.');
  await editor.getByLabel('Category').selectOption('mains');
  await editor.getByRole('button', { name: 'Sizes' }).click();
  await editor.getByRole('button', { name: /^Add dish/ }).click();
  await expect(editor).toContainText('Each size needs a name');
  const names = editor.getByPlaceholder('e.g. Half');
  const prices = editor.getByPlaceholder('₹');
  await names.nth(0).fill('Regular');
  await prices.nth(0).fill('180');
  await names.nth(1).fill('Ghee roast');
  await prices.nth(1).fill('220');
  await editor.getByRole('button', { name: /^Add dish/ }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Masala Dosa added to the menu' }),
  ).toBeVisible();
  await expect(page.getByText('Regular ₹180')).toBeVisible();

  await page.goto('/menu/mains/');
  await expect(page.getByText('Masala Dosa').first()).toBeVisible();
});
