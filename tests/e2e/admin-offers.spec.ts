import { expect, test, adminSignIn, againstBackend, scan } from './helpers';

/**
 * Settings › Offers against the backend: staff add an offer (a lunch special on mains, from
 * noon), guests see it on the menu at once; paused, it's gone; then it's removed. It starts at
 * lunchtime (1:00 PM in India), inside the new offer's hours. The mock can't save offers.
 */

test.skip(!againstBackend, 'Saving offers needs the backend');

test('add an offer, see it on the menu, pause it and remove it', async ({ page }) => {
  test.slow();
  await adminSignIn(page);
  await page.goto('/admin/dashboard/settings/offers/');
  await expect(page.getByRole('heading', { level: 2, name: 'Happy hour' })).toBeVisible();

  await page.getByRole('button', { name: 'Add offer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add offer' });
  await dialog.getByLabel('Name').fill('Lunch special');
  await dialog.getByLabel('From').fill('12:00');
  await dialog.getByLabel('Until').fill('15:00');
  await dialog.getByLabel('Percent off each item').fill('10');
  // Nothing covered yet: it says so.
  await dialog.getByRole('button', { name: 'Add offer' }).click();
  await expect(dialog).toContainText('Pick at least one category or dish.');
  await dialog.getByRole('button', { name: 'Mains', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add offer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Lunch special added' })).toBeVisible();
  const card = page.getByRole('listitem').filter({ hasText: 'Lunch special' });
  await expect(card).toContainText('On now');
  await expect(card).toContainText('10% off · On Mains');

  // Guests see it on the menu straight away.
  await scan(page, 'table=12');
  await page.goto('/menu/');
  await expect(
    page
      .getByText(/Lunch special · 10% off Mains till 3:00 PM/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();

  // Paused: still listed for staff, gone for guests.
  await page.goto('/admin/dashboard/settings/offers/');
  await card.getByRole('button', { name: 'Pause Lunch special' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Lunch special paused' })).toBeVisible();
  await expect(card).toContainText('Paused');
  await page.goto('/menu/');
  await expect(page.getByText(/Lunch special/).filter({ visible: true })).toHaveCount(0);

  // Removed.
  await page.goto('/admin/dashboard/settings/offers/');
  await card.getByRole('button', { name: 'Remove Lunch special' }).click();
  await page
    .getByRole('dialog', { name: 'Remove Lunch special?' })
    .getByRole('button', { name: 'Remove offer' })
    .click();
  await expect(page.getByRole('status').filter({ hasText: 'Lunch special removed' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Lunch special' })).toHaveCount(0);
});
