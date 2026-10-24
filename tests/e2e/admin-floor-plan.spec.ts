import { expect, test, adminSignIn } from './helpers';

/**
 * Settings › Floor plan against the mock server: staff add an area with three tables, change a
 * table, rename and move the area, and save; the Tables page and the new tables' pages follow.
 * With one area left, the Tables page shows its tables without area tabs.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('add an area and tables, change them, save; the Tables page follows', async ({ page }) => {
  test.slow();
  await adminSignIn(page);
  await page.goto('/admin/dashboard/settings/');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  const card = page.getByRole('link', { name: /^Floor plan/ }).last();
  await expect(card).toContainText('3 areas · 18 tables');
  await card.click();
  await expect(page).toHaveURL(/\/settings\/floor-plan\/$/);

  // A new area with three two-seaters, numbered on from the highest table.
  await page.getByRole('button', { name: 'Add area' }).click();
  const areaDialog = page.getByRole('dialog', { name: 'Add an area' });
  await areaDialog.getByLabel('Name').fill('outdoor');
  await areaDialog.getByRole('button', { name: 'Add area' }).click();
  await expect(areaDialog).toContainText('Another area has this name');
  await areaDialog.getByLabel('Name').fill('Roof terrace');
  await areaDialog.getByRole('button', { name: 'Add area' }).click();
  const roof = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Roof terrace' }),
  });
  await expect(roof).toContainText('No tables in this area yet.');

  await roof.getByRole('button', { name: 'Add a table to Roof terrace' }).click();
  const add = page.getByRole('dialog', { name: 'Add tables' });
  await add.getByRole('button', { name: /Add one How many/ }).click();
  await add.getByRole('button', { name: /Add one How many/ }).click();
  await add.getByRole('button', { name: /Remove one Seats/ }).click();
  await add.getByRole('button', { name: /Remove one Seats/ }).click();
  await expect(add.getByRole('status').filter({ hasText: 'Tables' })).toHaveText(
    'Tables 19–21 · 2 seats each',
  );
  await add.getByLabel('First number').fill('18');
  await expect(add).toContainText('Table 18 is already on the plan');
  await add.getByLabel('First number').fill('19');
  await add.getByRole('button', { name: 'Add 3 tables' }).click();
  await expect(roof.getByRole('button', { name: /^Table \d+, 2 seats/ })).toHaveCount(3);
  await expect(roof).toContainText('New');

  // Table 21 gets six seats; the area is renamed and moved up one.
  await roof.getByRole('button', { name: 'Table 21, 2 seats. Change' }).click();
  const edit = page.getByRole('dialog', { name: 'Table 21' });
  for (let i = 0; i < 4; i++) await edit.getByRole('button', { name: /Add one Seats/ }).click();
  await edit.getByRole('button', { name: 'Save table' }).click();
  await roof.getByRole('button', { name: 'Rename Roof terrace' }).click();
  const rename = page.getByRole('dialog', { name: 'Rename area' });
  await rename.getByLabel('Name').fill('Rooftop');
  await rename.getByRole('button', { name: 'Save name' }).click();
  await page.getByRole('button', { name: 'Move Rooftop up' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Ground floor',
    'First floor',
    'Rooftop',
    'Outdoor',
  ]);

  // Saved, the unsaved-changes bar goes.
  const bar = page.getByRole('region', { name: 'Unsaved changes' });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Floor plan saved' })).toBeVisible();
  await expect(bar).toBeHidden();
  await expect(page.getByText('4 areas', { exact: true })).toBeVisible();

  // The Tables page has the new area, and a new table opens.
  await page.goto('/admin/dashboard/tables/');
  await page.getByRole('tab', { name: /^Rooftop/ }).click();
  await page.getByRole('link', { name: /^Table 21, 6 seats/ }).click();
  await expect(page).toHaveURL(/\/tables\/view\/\?table=21$/);
  await expect(page.getByRole('heading', { name: /Table 21/ }).first()).toBeVisible();
});

test('one area: no area tabs on the Tables page', async ({ page }) => {
  test.slow();
  await adminSignIn(page, 'Thamel');
  await page.goto('/admin/dashboard/settings/floor-plan/');
  for (const area of ['First floor', 'Courtyard']) {
    await page.getByRole('button', { name: `Remove ${area}` }).click();
    const confirm = page.getByRole('dialog', { name: `Remove ${area}?` });
    await expect(confirm).toContainText('come off the plan too');
    await confirm.getByRole('button', { name: 'Remove area' }).click();
  }
  await expect(page.getByText('With one area, the Tables page shows its tables')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Floor plan saved' })).toBeVisible();

  await page.goto('/admin/dashboard/tables/');
  await expect(page.getByRole('link', { name: /^Table 1,/ })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
});

test('a table out of service: marked on the floor plan, and a guest scanning it is told', async ({
  page,
}) => {
  test.slow();
  await adminSignIn(page, 'Thamel');
  await page.goto('/admin/dashboard/settings/floor-plan/');
  await page.getByRole('button', { name: 'Table 3, 4 seats. Change' }).click();
  const dialog = page.getByRole('dialog', { name: 'Table 3' });
  const service = dialog.getByRole('switch', { name: /In service/ });
  await expect(service).toBeChecked();
  await service.uncheck();
  await expect(dialog).toContainText('Out of service: kept on the plan');
  await dialog.getByRole('button', { name: 'Save table' }).click();
  await expect(
    page.getByRole('button', { name: /^Table 3, 4 seats\. Change · Out of service$/ }),
  ).toBeVisible();
  await expect(page.getByText('1 out of service')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Floor plan saved' })).toBeVisible();

  // The floor plan marks it; its page says why and offers no order or booking.
  await page.goto('/admin/dashboard/tables/');
  const tile = page.getByRole('link', { name: /^Table 3, 4 seats: Out of service/ });
  await expect(tile).toBeVisible();
  await expect(page.getByRole('list', { name: 'On this floor' })).toContainText('Out of service');
  await tile.click();
  await expect(page.getByText('This table is out of service')).toBeVisible();
  await expect(page.getByRole('button', { name: /Take order/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reserve' })).toHaveCount(0);

  // A guest scanning its QR code gets the start screen (takeaway still works), told to ask staff.
  await page.goto('/?branch=ktm-thamel&table=3');
  await expect(page.getByRole('heading', { name: 'How would you like to order?' })).toBeVisible();
  await expect(page.getByText("Table 3 isn't taking orders right now.")).toBeVisible();

  // Back in service.
  await page.goto('/admin/dashboard/settings/floor-plan/');
  await page.getByRole('button', { name: /^Table 3, 4 seats\. Change/ }).click();
  await page.getByRole('dialog', { name: 'Table 3' }).getByRole('switch').check();
  await page
    .getByRole('dialog', { name: 'Table 3' })
    .getByRole('button', { name: 'Save table' })
    .click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Floor plan saved' })).toBeVisible();
  await expect(page.getByText('1 out of service')).toHaveCount(0);
});
