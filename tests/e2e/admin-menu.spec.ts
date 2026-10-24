import { expect, test, adminSignIn, scan } from './helpers';

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
  await page.goto('/dish/?slug=dahi-kebab');
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

test("a thali's choices, the order of dishes, and removing a dish", async ({ page }) => {
  test.slow();
  await scan(page, 'table=5');
  await adminSignIn(page);
  await page.goto('/admin/dashboard/menu/');

  // Veg Thali: every choice group is there; a curry costs more.
  await page.getByRole('button', { name: 'Edit Veg Thali' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Veg Thali' });
  await editor.getByText('Choices', { exact: true }).click();
  for (const group of [
    'Choose your curry',
    'Choose your bread',
    'Choose your rice',
    'Choose your dessert',
    'Choose your drink',
  ]) {
    await expect(
      editor.getByRole('textbox', { name: 'Group name' }).and(editor.locator(`[value="${group}"]`)),
    ).toHaveCount(1);
  }
  const extras = editor.getByRole('textbox', { name: /^Extra/ });
  await extras.first().fill('25');
  await editor.getByRole('button', { name: /^Save dish/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Veg Thali saved' })).toBeVisible();

  // The guest picks a curry and sees the new price.
  await page.goto('/dish/?slug=veg-thali');
  await expect(page.getByText(/Dal Makhani/).first()).toBeVisible();
  await expect(page.getByText('+₹25').first()).toBeVisible();

  // Reorder Starters: Dahi Kebab first.
  await page.goto('/admin/dashboard/menu/');
  await page.getByRole('button', { name: 'Starters', exact: true }).click();
  await page.getByRole('button', { name: /^Reorder/ }).click();
  await page.getByRole('button', { name: 'Move Dahi Kebab up' }).click();
  await page.getByRole('button', { name: 'Move Dahi Kebab up' }).click();
  await page.getByRole('button', { name: /^Save order/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Order saved' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Menu' }).getByRole('listitem').first(),
  ).toContainText('Dahi Kebab');

  // Remove a dish.
  await page.getByRole('button', { name: 'Edit Crispy Corn Chaat' }).click();
  await page.getByRole('button', { name: 'Remove dish' }).click();
  await page
    .getByRole('dialog', { name: 'Remove Crispy Corn Chaat?' })
    .getByRole('button', { name: 'Remove dish' })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Crispy Corn Chaat removed from the menu' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Crispy Corn Chaat' })).toHaveCount(0);
  await page.goto('/menu/starters/');
  await expect(page.getByText('Dahi Kebab').first()).toBeVisible();
  await expect(page.getByText('Crispy Corn Chaat')).toHaveCount(0);
});
