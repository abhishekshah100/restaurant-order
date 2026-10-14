import { expect, test, type Page } from '@playwright/test';
import {
  addDish,
  adminSignIn,
  callWaiter,
  expectBranchOpen,
  orderAtCounter,
  scan,
} from './helpers';

/**
 * The waiter home (/admin/dashboard/) against the mock server, in the same browser as a guest:
 * the guest at table 12 orders at the counter and calls a waiter; the demo admin signs in,
 * picks Indiranagar and sees the call; Done clears it (and the guest's request); once the
 * kitchen has the order ready (Playwright's clock) Mark served clears that too and the guest's
 * tracking says Served. Then the shared navigation: the bottom tab bar and More at 390px, the
 * sidebar at 1280px, Switch branch and Sign out.
 */

const counter = (page: Page, count: number, label: string) =>
  page
    .getByRole('region', { name: 'Right now' })
    .getByRole('link', { name: new RegExp(`^${count} ${label}`) });

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=12');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('a waiter call and a ready order, from the guest to Done and Mark served', async ({
  page,
}) => {
  test.slow();
  // 8:30 PM in Bengaluru.
  await page.clock.install({ time: new Date('2026-10-08T15:00:00Z') });
  await scan(page, 'table=12');
  await addDish(page, 'starters', 'Dahi Kebab');
  const orderId = await orderAtCounter(page);
  await callWaiter(page);

  await adminSignIn(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Good evening, Abhishek' }),
  ).toBeVisible();
  await expect(counter(page, 1, 'Waiter calls')).toBeVisible();
  await expect(counter(page, 0, 'Ready to serve')).toBeVisible();

  const queue = page.getByRole('region', { name: 'Needs you now' });
  const call = queue.getByRole('listitem').filter({ hasText: 'Needs water' });
  await expect(call).toContainText('12');
  await expect(call).toContainText('“No ice, please”');
  await call.getByRole('button', { name: /^Done/ }).click();
  await expect(call).toHaveCount(0);
  await expect(counter(page, 0, 'Waiter calls')).toBeVisible();
  await expect(queue).toContainText('All caught up');

  // The kitchen has it ready 18 minutes after it was ordered; the home polls every 15 s.
  await page.clock.fastForward('18:30');
  const ready = queue.getByRole('listitem').filter({ hasText: `Order ${orderId} is ready` });
  await expect(ready).toBeVisible();
  await expect(ready).toContainText('Ananya Rao');
  await expect(counter(page, 1, 'Ready to serve')).toBeVisible();
  await ready.getByRole('button', { name: /^Mark served/ }).click();
  await expect(ready).toHaveCount(0);
  await expect(counter(page, 0, 'Ready to serve')).toBeVisible();

  // The guest's side: the request is done, and the order is served.
  await page.goto('/help/waiter-requested/');
  await expect(page.getByRole('heading', { name: 'No open request' })).toBeVisible();
  await page.goto(`/order/track/?id=${orderId}`);
  await expect(page.getByText('Served').filter({ visible: true }).first()).toBeVisible();
});

test('the shared navigation, Switch branch and Sign out', async ({ page }, testInfo) => {
  await adminSignIn(page);
  const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('link', { name: 'Tables' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/tables\/$/);
  await expect(nav.getByRole('link', { name: 'Tables' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: /^Orders/ }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/orders\/$/);

  if (testInfo.project.name === 'mobile') {
    // Menu and Payments, Switch branch and Sign out are under More.
    await nav.getByRole('button', { name: 'More' }).click();
    const more = page.getByRole('dialog', { name: 'More' });
    await more.getByRole('link', { name: 'Payments' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/payments\/$/);
    await expect(more).toBeHidden();

    await nav.getByRole('button', { name: 'More' }).click();
    await more.getByRole('button', { name: 'Switch branch' }).click();
  } else {
    await nav.getByRole('link', { name: 'Payments' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/payments\/$/);
    await page.getByRole('button', { name: 'Switch branch' }).click();
  }

  await expect(page).toHaveURL(/\/admin\/select-branch\/$/);
  await page.getByRole('button', { name: 'Thamel', exact: true }).click();
  await expectBranchOpen(page, 'Thamel');

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Account and more' }).click();
    await page
      .getByRole('dialog', { name: 'More' })
      .getByRole('button', { name: 'Sign out' })
      .click();
  } else {
    await page.getByRole('button', { name: 'Sign out' }).click();
  }
  await expect(page).toHaveURL(/\/admin\/login\/$/);
  await page.goto('/admin/dashboard/');
  await expect(page).toHaveURL(/\/admin\/login\/$/);
});
