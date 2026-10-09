import { expect, test, type Page } from '@playwright/test';
import { dishSlug, scan, waitForSavedCart } from './helpers';

/**
 * After an order is placed: a running dine-in order takes more rounds without a new checkout
 * (both demo branches pay at the end of the meal), the change / cancel window
 * (GET /branches › ordering.cancelWindowSeconds, 2 minutes) and Order again. Runs at a mobile
 * (390px) and a desktop (1280px) viewport — see playwright.config.ts.
 */

const visible = (page: Page, role: Parameters<Page['getByRole']>[0], name: string | RegExp) =>
  page.getByRole(role, { name }).filter({ visible: true }).first();

const text = (page: Page, value: string | RegExp) =>
  page.getByText(value).filter({ visible: true }).first();

/** Adds a dish from a menu category and waits until the cart is saved. */
async function addDish(page: Page, category: string, dish: string) {
  await page.goto(`/menu/${category}/`);
  // On a busy machine the first tap can land before the page has hydrated: tap again if needed.
  const stepper = page.getByRole('group', { name: `Quantity of ${dish}` }).first();
  await expect(async () => {
    if (!(await stepper.isVisible())) {
      await page.getByRole('button', { name: `Add ${dish}` }).click({ timeout: 2000 });
    }
    await expect(stepper).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await waitForSavedCart(page, dishSlug(dish));
}

/** Checks out the cart as a first order: details, OTP, then online or at the counter. */
async function checkout(page: Page, phone: string, pay: 'online' | 'counter') {
  await page.goto('/checkout/details/');
  await page.getByLabel('Full name').fill('Ananya Rao');
  await page.getByLabel('Mobile number').fill(phone);
  await visible(page, 'button', 'Send OTP').click();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await visible(page, 'button', 'Verify & continue').click();
  await expect(page).toHaveURL(/\/checkout\/payment\/$/);
  if (pay === 'online') {
    await visible(page, 'button', /^Pay /).click();
    await visible(page, 'button', 'Prototype: success').click();
  } else {
    await page.getByRole('radio', { name: /Pay at the counter/ }).click();
    await visible(page, 'button', /^Place order/).click();
  }
  await expect(page).toHaveURL(/\/order\/confirmed\/\?id=A\d+$/);
}

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=12');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('dine-in: a second round goes on the order without checkout, and the bill shows both', async ({
  page,
}) => {
  test.slow();
  // 8:30 PM in Bengaluru: after the drawn "today" orders (7:42 PM), so the new one lists first.
  await page.clock.install({ time: new Date('2026-10-08T15:00:00Z') });
  await scan(page, 'table=12');
  // Dahi Kebab ₹289 → ₹303 with 5% GST, at the counter.
  await addDish(page, 'starters', 'Dahi Kebab');
  await checkout(page, '9876543210', 'counter');
  await expect(text(page, 'You can change or cancel for')).toBeVisible();

  // Round 2: the cart adds to the order instead of checking out.
  await addDish(page, 'starters', 'Hara Bhara Kebab');
  await page.goto('/cart/');
  await expect(visible(page, 'heading', /^Adding to order #A\d+$/)).toBeVisible();
  await expect(visible(page, 'link', 'Checkout')).toHaveCount(0);
  await visible(page, 'button', 'Add to my order').click();

  await expect(page).toHaveURL(/\/order\/track\/\?id=A\d+$/);
  await expect(
    page.getByRole('status').filter({ hasText: 'Round 2 is on its way to the kitchen' }),
  ).toBeVisible();
  const rounds = page.getByRole('list', { name: 'Rounds on this order' });
  await expect(rounds.getByRole('heading', { name: /^Round 1/ })).toBeVisible();
  await expect(rounds.getByRole('heading', { name: /^Round 2/ })).toBeVisible();
  await expect(rounds).toContainText('1 × Dahi Kebab');
  await expect(rounds).toContainText('1 × Hara Bhara Kebab');
  // One bill for the whole order: ₹289 + ₹259 = ₹548, + 5% GST = ₹575.40 → ₹575.
  await expect(text(page, '₹575')).toBeVisible();
  await expect(text(page, 'You can change or cancel round 2 for')).toBeVisible();

  // The cart is empty again, and checkout isn't needed for the next round either.
  await page.goto('/cart/');
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();

  // The bill: one line for the order, covering both rounds.
  await page.goto('/help/bill/');
  await page.getByRole('radio', { name: /Just my orders/ }).click();
  const row = page.getByRole('listitem').filter({ hasText: '₹575' });
  await expect(row).toContainText('2 rounds');
  await expect(row).toContainText('Unpaid');
  await expect(
    page.getByText('Balance due', { exact: true }).filter({ visible: true }).first().locator('..'),
  ).toContainText('₹575');

  await page.goto('/orders/');
  await expect(visible(page, 'link', /#A\d+/)).toContainText('2 rounds');
});

test('cancel within the window', async ({ page }) => {
  test.slow();
  await scan(page, 'table=12');
  await addDish(page, 'starters', 'Dahi Kebab');
  await checkout(page, '9876543210', 'online');

  await visible(page, 'button', 'Cancel order').click();
  const dialog = page.getByRole('dialog', { name: /^Cancel order #A\d+\?$/ });
  await expect(dialog).toContainText('₹303 you paid online will be refunded to your UPI account.');
  await dialog.getByRole('button', { name: 'Yes, cancel' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'You cancelled this order' }),
  ).toBeVisible();
  await expect(text(page, 'Cancelled by you')).toBeVisible();
  await expect(text(page, 'Refund of ₹303 started to your UPI account')).toBeVisible();

  // It's off the table's bill.
  await page.goto('/help/bill/');
  await expect(text(page, '#A104')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: '₹303' })).toHaveCount(0);
});

test('change within the window updates the items and the total', async ({ page }) => {
  test.slow();
  await scan(page, 'table=12');
  await addDish(page, 'starters', 'Dahi Kebab');
  await checkout(page, '9876543210', 'online');

  await visible(page, 'button', 'Change order').click();
  await expect(page).toHaveURL(/\/cart\/$/);
  await expect(visible(page, 'heading', /^Editing order #A\d+$/)).toBeVisible();
  await expect(text(page, /left to make changes/)).toBeVisible();
  await visible(page, 'button', 'Add one Dahi Kebab').click();

  // Paid online: the higher total (2 × ₹289 = ₹578 → ₹607) needs the ₹304 difference.
  await visible(page, 'button', 'Update order').click();
  const dialog = page.getByRole('dialog', { name: 'Pay the difference' });
  await expect(dialog).toContainText(
    "Your updated order comes to ₹607. You've paid ₹303 online, so ₹304 is left to pay.",
  );
  await dialog.getByRole('button', { name: 'Pay ₹304' }).click();
  await dialog.getByRole('button', { name: 'Prototype: success' }).click();

  await expect(page).toHaveURL(/\/order\/track\/\?id=A\d+$/);
  await expect(page.getByRole('status').filter({ hasText: /^Order #A\d+ updated$/ })).toBeVisible();
  await expect(text(page, '2 × Dahi Kebab')).toBeVisible();
  await expect(text(page, '₹607')).toBeVisible();
  await expect(text(page, 'Total paid')).toBeVisible();

  // The cart is back to what it held before editing (nothing).
  await page.goto('/cart/');
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});

test('after the window the actions are gone', async ({ page }) => {
  await page.clock.install();
  await scan(page, 'table=12');
  await addDish(page, 'starters', 'Dahi Kebab');
  await checkout(page, '9876543210', 'counter');
  await expect(visible(page, 'button', 'Change order')).toBeVisible();

  // Two minutes on: the window has closed and the kitchen has started.
  await page.clock.fastForward('02:05');
  // Whichever the page learns first: the countdown ran out, or the kitchen started (a poll).
  await expect(
    text(page, /^(The time to change or cancel it has passed|The kitchen has started on it)/),
  ).toBeVisible();
  await expect(visible(page, 'button', 'Change order')).toHaveCount(0);
  await expect(visible(page, 'button', 'Cancel order')).toHaveCount(0);

  await page.getByRole('link', { name: 'Track order' }).filter({ visible: true }).click();
  await expect(
    text(page, 'The kitchen has started on it, so it can no longer be changed or cancelled.'),
  ).toBeVisible();
  await expect(text(page, 'Need something changed? Call a waiter.')).toBeVisible();
  await expect(visible(page, 'button', 'Cancel order')).toHaveCount(0);
});

test('order again from My orders fills the cart', async ({ page }) => {
  await scan(page, 'table=12');
  // An earlier order on this device with a dish that's off the menu today.
  await page.evaluate(() => {
    const order = {
      id: 'A105',
      table: 12,
      customerName: 'Ananya Rao',
      placedBy: 'you',
      placedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
      status: 'served',
      items: [
        {
          dishSlug: 'masala-chai',
          name: 'Masala Chai',
          veg: true,
          quantity: 2,
          details: [],
          unitPrice: 99,
        },
        {
          dishSlug: 'wild-mushroom-risotto',
          name: 'Wild Mushroom Risotto',
          veg: true,
          quantity: 1,
          details: [],
          unitPrice: 429,
        },
      ],
      itemTotal: 627,
      total: 658,
      payment: { method: 'online', status: 'paid' },
      timeline: [{ status: 'received', time: '7:00 PM' }],
    };
    localStorage.setItem('olive.orders.v1', JSON.stringify([order]));
  });

  await page.goto('/orders/');
  await visible(page, 'button', 'Order again (order #A061)').click();
  await expect(page).toHaveURL(/\/cart\/$/);
  await expect(
    page.getByRole('status').filter({ hasText: 'Added to your cart from order #A061' }),
  ).toBeVisible();
  const items = page.getByRole('list', { name: 'Items in cart' });
  await expect(items).toContainText('Dal Makhani');
  await expect(items).toContainText('Butter Naan');
  await expect(items).toContainText('Jeera Rice');
  await expect(items.getByRole('group', { name: 'Quantity of Butter Naan' })).toContainText('2');

  await page.goto('/orders/');
  await visible(page, 'button', 'Order again (order #A105)').click();
  await expect(
    page.getByRole('status').filter({
      hasText: 'Added to your cart. Not available right now: Wild Mushroom Risotto',
    }),
  ).toBeVisible();
  await expect(page.getByRole('list', { name: 'Items in cart' })).toContainText('Masala Chai');
  await expect(page.getByRole('list', { name: 'Items in cart' })).not.toContainText('Risotto');
});

test('Nepal: a second round on the tab, then taking it back', async ({ page }) => {
  test.slow();
  // 7:45 PM in Kathmandu: after happy hour, so the chai is at its menu price.
  await page.clock.install({ time: new Date('2026-10-03T14:00:00Z') });
  await scan(page, 'branch=ktm-thamel&table=5');
  // Dahi Kebab रू 460 + 10% service + 13% VAT = रू 572, at the counter.
  await addDish(page, 'starters', 'Dahi Kebab');
  await checkout(page, '9841234567', 'counter');

  await addDish(page, 'beverages', 'Masala Chai');
  await page.goto('/cart/');
  await visible(page, 'button', 'Add to my order').click();
  await expect(page).toHaveURL(/\/order\/track\/\?id=A\d+$/);
  // The tab as one bill: रू 620 + रू 62 service + 13% VAT (रू 88.66) = रू 770.66 → रू 771.
  await expect(text(page, 'रू 771')).toBeVisible();

  await visible(page, 'button', 'Cancel round 2').click();
  const dialog = page.getByRole('dialog', { name: 'Cancel round 2?' });
  await dialog.getByRole('button', { name: 'Yes, cancel' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Round 2 cancelled' })).toBeVisible();
  await expect(text(page, 'रू 572')).toBeVisible();
});
