import type { Page } from '@playwright/test';
import { expect, test, adminSignIn, againstBackend } from './helpers';

/**
 * Settings beyond the floor plan, on the mock server or the backend: opening hours, tax & service
 * charge, payment methods, delivery zones and pickup save as drafts and reach guests; branches
 * are added as a copy of another and removed, never the last one or one with bills open.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

async function openSetting(page: Page, name: string, path: string) {
  await page.goto('/admin/dashboard/settings/');
  await page
    .getByRole('link', { name: new RegExp(`^${name}`) })
    .last()
    .click();
  await expect(page).toHaveURL(new RegExp(`/settings/${path}/$`));
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

async function saveChanges(page: Page, saved: string) {
  const bar = page.getByRole('region', { name: 'Unsaved changes' });
  await bar.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: saved })).toBeVisible();
  await expect(bar).toBeHidden();
}

test('opening hours, tax, payments, delivery and pickup save and show on Settings', async ({
  page,
}) => {
  test.slow();
  await adminSignIn(page, 'Udyog Vihar');
  await page.goto('/admin/dashboard/settings/');
  await expect(page.getByRole('link', { name: /^Opening hours/ }).last()).toContainText(
    'Open 7 days a week',
  );

  // Opening hours: Sunday off; a second Monday session that overlaps the first is refused, a
  // late one after it is fine; and a special date (a holiday, closed).
  await openSetting(page, 'Opening hours', 'hours');
  await page.getByRole('switch', { name: 'Open on Sunday' }).first().uncheck();
  // Monday's Add session (the week lists Monday first).
  await page.getByRole('button', { name: 'Add session' }).first().click();
  const bar = page.getByRole('region', { name: 'Unsaved changes' });
  await page.locator('#opening-mon-1-opens').fill('20:00');
  await expect(bar).toContainText("Sessions can't overlap");
  await expect(bar.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await page.locator('#opening-mon-1-label').fill('Late night');
  await page.locator('#opening-mon-1-opens').fill('21:30');
  await page.locator('#opening-mon-1-closes').fill('23:00');
  await page.getByRole('button', { name: 'Add special date' }).click();
  await page.locator('#special-0-label').fill('Diwali');
  await saveChanges(page, 'Opening hours saved');

  // Tax: a 10% service charge, shown on the example bill.
  await openSetting(page, 'Tax & service charge', 'tax');
  await page.getByRole('switch', { name: 'Add a service charge' }).check();
  await page.getByLabel('Rate (%)').last().fill('10');
  await expect(page.getByText('Service charge (10%)')).toBeVisible();
  await saveChanges(page, 'Tax & service charge saved');

  // Payment methods: every method off at checkout is refused.
  await openSetting(page, 'Payment methods', 'payments');
  const checkout = page.locator('section').filter({ hasText: 'Dine-in checkout' });
  await checkout.getByRole('checkbox', { name: /^Pay online now/ }).uncheck();
  await checkout.getByRole('checkbox', { name: /^Pay at the counter/ }).uncheck();
  await expect(checkout).toContainText('Offer at least one payment method here.');
  await checkout.getByRole('checkbox', { name: /^Pay at the counter/ }).check();
  await saveChanges(page, 'Payment methods saved');

  // Delivery: a new zone can't take an area another zone has.
  await openSetting(page, 'Delivery zones', 'delivery');
  await page.getByRole('button', { name: 'Add zone' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a delivery zone' });
  await dialog.getByLabel('Zone name').fill('Airport');
  await dialog.getByLabel('Areas').fill('Domlur, Murugeshpalya');
  await expect(dialog).toContainText('already in another zone');
  await dialog.getByLabel('Areas').fill('Murugeshpalya');
  await dialog.getByLabel(/Delivery fee/).fill('59');
  await dialog.getByRole('button', { name: 'Add zone' }).click();
  await expect(page.getByRole('heading', { name: 'Airport' })).toBeVisible();
  await saveChanges(page, 'Delivery zones saved');

  // Pickup: slots every 30 minutes.
  await openSetting(page, 'Pickup', 'pickup');
  await page.getByRole('radio', { name: 'Every 30 min' }).click();
  await saveChanges(page, 'Pickup saved');

  await page.goto('/admin/dashboard/settings/');
  await expect(page.getByRole('link', { name: /^Opening hours/ }).last()).toContainText(
    'Open 6 days a week',
  );
  await expect(page.getByRole('link', { name: /^Tax & service charge/ }).last()).toContainText(
    'service charge 10%',
  );
  await expect(page.getByRole('link', { name: /^Delivery zones/ }).last()).toContainText(
    'Delivering · 4 zones',
  );
  await expect(page.getByRole('link', { name: /^Pickup/ }).last()).toContainText(
    'slots every 30 min',
  );
});

test('services switch on and off; the region is editable on Branch details', async ({ page }) => {
  test.slow();
  await adminSignIn(page, 'Udyog Vihar');

  // Services: never all off; dine-in off shows on Settings.
  await openSetting(page, 'Services', 'services');
  for (const name of ['Dine-in', 'Takeaway', 'Delivery']) {
    await page.getByRole('switch', { name }).uncheck();
  }
  const bar = page.getByRole('region', { name: 'Unsaved changes' });
  await expect(bar).toContainText('Keep at least one way to order switched on.');
  await page.getByRole('switch', { name: 'Takeaway' }).check();
  await page.getByRole('switch', { name: 'Delivery' }).check();
  await saveChanges(page, 'Services saved');
  await page.goto('/admin/dashboard/settings/');
  await expect(page.getByRole('link', { name: /^Services/ }).last()).toContainText(
    'Takeaway · Delivery',
  );

  // Region: another country warns what comes with it, and the phone must follow.
  await openSetting(page, 'Branch details', 'branch');
  await page.getByLabel('Country').selectOption('NP');
  await expect(page.getByLabel('Time zone')).toHaveValue('Asia/Kathmandu');
  await expect(page.getByLabel('Currency')).toHaveValue('NPR');
  await expect(page.getByText(/Moving the branch to Nepal/)).toBeVisible();
  await expect(bar).toContainText('+977');
  // The time zone is typed, with suggestions; an unknown one is refused.
  await page.getByLabel('Time zone').fill('Asia/Nowhere');
  await expect(page.getByText('Choose a time zone from the list').first()).toBeVisible();
  await page.getByLabel('Time zone').fill('Asia/Kathmandu');
  await expect(page.getByText(/Local time now/)).toBeVisible();
  await page.getByLabel('Country').selectOption('IN');
  await page.getByLabel('Currency').selectOption('USD');
  await expect(page.getByText('Menu prices keep their numbers')).toBeVisible();
  await saveChanges(page, 'Branch details saved');
  await expect(page.getByLabel('Currency')).toHaveValue('USD');
});

test('add a branch as a copy, then remove it; never the last one', async ({ page }) => {
  test.slow();
  await adminSignIn(page, 'Udyog Vihar');
  await openSetting(page, 'Branches', 'branches');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2);

  await page.getByRole('button', { name: 'Add branch' }).click();
  const add = page.getByRole('dialog', { name: 'Add a branch' });
  await add.getByRole('button', { name: 'Add branch' }).click();
  await expect(add).toContainText("Enter the branch's name");
  await add.getByLabel('Name', { exact: true }).fill('The Olive Table — Sector 29');
  await add.getByLabel('Short name').fill('Thamel');
  await add.getByLabel('Address').fill('Sector 29, Gurgaon');
  await add.getByLabel('Phone').fill('+91 98111 22233');
  await add.getByRole('button', { name: 'Add branch' }).click();
  await expect(add).toContainText('Another branch has this short name');
  await add.getByLabel('Short name').fill('Sector 29');
  await add.getByRole('button', { name: 'Add branch' }).click();
  await expect(add).toBeHidden();
  await expect(page.getByRole('heading', { name: 'The Olive Table — Sector 29' })).toBeVisible();

  // Guests can choose it on the start screen.
  await page.goto('/start/');
  await expect(page.getByText('Sector 29').first()).toBeVisible();

  await page.goto('/admin/dashboard/settings/branches/');
  for (const name of ['Sector 29', 'Thamel']) {
    await page.getByRole('button', { name: `Remove ${name}` }).click();
    await page
      .getByRole('dialog', { name: `Remove ${name}?` })
      .getByRole('button', { name: 'Remove branch' })
      .click();
    await expect(page.getByRole('status').filter({ hasText: `${name} removed` })).toBeVisible();
  }
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
  await expect(page.getByText('This is your only branch.')).toBeVisible();
  await expect(page.getByRole('button', { name: /can't be removed/ })).toBeDisabled();
});

test('a branch with bills open today stays', async ({ page }) => {
  // The backend knows of open bills once it has the Orders module (Module 5).
  test.skip(againstBackend, 'open bills need the Orders module on the backend');
  await adminSignIn(page, 'Udyog Vihar');
  await openSetting(page, 'Branches', 'branches');
  await page.getByRole('button', { name: 'Remove Udyog Vihar' }).click();
  const remove = page.getByRole('dialog', { name: 'Remove Udyog Vihar?' });
  await remove.getByRole('button', { name: 'Remove branch' }).click();
  await expect(remove).toContainText('orders today still to finish or pay');
  await remove.getByRole('button', { name: 'Keep branch' }).click();
  await expect(remove).toBeHidden();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2);
});
