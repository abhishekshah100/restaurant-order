import { expect, test, adminSignIn, againstBackend, callWaiter, scan, visible } from './helpers';

/**
 * The Requests page against the mock server, in the same browser as a guest: the guest at
 * table 5 asks for water; staff see it under Waiting, tap On my way (the guest's page then says
 * who's coming), then Done — it moves to Done in the last 30 min with who handled it, and the
 * guest's request clears.
 */

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=5');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('a waiter call from Waiting to On the way to Done', async ({ page }) => {
  test.slow();
  await scan(page, 'table=5');
  await callWaiter(page);

  await adminSignIn(page);
  await visible(page, 'link', 'Requests').click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/requests\/$/);
  await expect(page.getByRole('button', { name: /^Waiter calls/ })).toContainText('1');

  const waiting = page.getByRole('region', { name: /^Waiting/ });
  const call = waiting.getByRole('listitem').filter({ hasText: 'Needs water' });
  await expect(call).toContainText('“No ice, please”');
  await expect(call.getByRole('link', { name: 'Open Table 5' })).toBeVisible();
  await call.getByRole('button', { name: 'On my way: Needs water, Table 5' }).click();

  const coming = page.getByRole('region', { name: /^On the way/ });
  await expect(coming).toContainText("You're on the way");
  await expect(waiting).toHaveCount(0);
  // MOCK ONLY: the screen updates at once; wait until the in-browser server has saved it.
  if (!againstBackend) {
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('olive.service.v1') ?? ''))
      .toContain('"acknowledgedBy":"Abhishek Saha"');
  }

  // The guest's page says who's coming.
  await page.goto('/help/waiter-requested/');
  await expect(page.getByRole('heading', { name: 'Abhishek is on the way' })).toBeVisible();

  await page.goto('/admin/dashboard/requests/');
  await page
    .getByRole('region', { name: /^On the way/ })
    .getByRole('button', { name: 'Done: Needs water, Table 5' })
    .click();
  await expect(page.getByText('All caught up')).toBeVisible();
  await page.getByText('Done in the last 30 min').click();
  await expect(page.getByText(/Abhishek Saha · .* · Handled/)).toBeVisible();

  await page.goto('/help/waiter-requested/');
  await expect(page.getByRole('heading', { name: 'No open request' })).toBeVisible();
});
