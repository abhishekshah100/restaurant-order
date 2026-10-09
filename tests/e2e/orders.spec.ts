import { scan } from './helpers';
import { expect, test, type Page } from '@playwright/test';

/**
 * Orders: My orders → tracking → details, the cancelled state, live tracking of an
 * order placed on this device, and an unknown order.
 * Runs at a mobile (390px) and a desktop (1280px) viewport — see playwright.config.ts.
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=12');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  // A fresh guest at table 12 (without a QR code the start screen would open instead).
  await scan(page, 'table=12');
});

test('my orders → tracking → details', async ({ page }) => {
  await page.goto('/orders/');
  await expect(page.getByRole('heading', { level: 1, name: 'My orders' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /This visit · Today/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Earlier visits' })).toBeVisible();
  // Other guests' orders at the table aren't listed.
  await expect(page.getByText('#A101')).toHaveCount(0);

  // The active order opens live tracking.
  await page.getByRole('link', { name: /#A104/ }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/order\/track\/\?id=A104$/);
  await expect(page.getByText('12 min').filter({ visible: true })).toBeVisible();
  // A104 is a drawn mock order that doesn't refresh, so it doesn't claim to be live.
  await expect(page.getByText(/^Updated \d{1,2}:\d{2} [AP]M$/)).toBeVisible();
  await expect(page.getByText('1 × Paneer Tikka (Full)')).toBeVisible();
  await expect(page.getByText('In queue')).toBeVisible();
  await expect(page.getByText('₹1,424')).toBeVisible();
  if (isDesktop(page)) {
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('#A104');
  }

  // Call waiter opens the service request dialog.
  await page.getByRole('button', { name: 'Call waiter' }).filter({ visible: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('link', { name: 'Order #A104 details' }).click();
  await expect(page).toHaveURL(/\/order\/\?id=A104$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Order #A104' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Items (4)' })).toBeAttached();
  await expect(page.getByText('“Less cheese”')).toBeVisible();
  await expect(page.getByText('₹33.90').first()).toBeVisible();
  await expect(page.getByText('UPI · ananya@[bank]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Track live · ~12 min' })).toBeVisible();
});

test('a cancelled order explains the refund', async ({ page }) => {
  for (const path of ['/order/?id=A098', '/order/track/?id=A098']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: 'The kitchen had to cancel this order' }),
    ).toBeVisible();
    await expect(page.getByText('Truffle Mushroom Pasta has just sold out')).toBeVisible();
    await expect(
      page.getByText('Refund of ₹409 started to your UPI account').filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByText('Cancelled by restaurant')).toBeVisible();
  }
  await page.getByRole('link', { name: 'Choose another dish' }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/menu\/mains\/$/);
});

test('an order placed on this device moves along live', async ({ page }) => {
  await page.evaluate(() => {
    const order = {
      id: 'A105',
      table: 12,
      customerName: 'Ananya Rao',
      placedBy: 'you',
      placedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
      status: 'received',
      items: [
        {
          dishSlug: 'masala-chai',
          name: 'Masala Chai',
          veg: true,
          quantity: 2,
          details: [],
          unitPrice: 99,
          status: 'queued',
        },
      ],
      itemTotal: 198,
      total: 208,
      payment: { method: 'counter', status: 'unpaid' },
      timeline: [{ status: 'received', time: '7:00 PM', note: 'Pay at counter' }],
      estimate: '18–22 min',
    };
    localStorage.setItem('olive.orders.v1', JSON.stringify([order]));
  });

  await page.goto('/order/track/?id=A105');
  await expect(page.getByText('Ready in about')).toBeVisible();
  await expect(page.getByText('10 min').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('Order status: Preparing')).toBeAttached();
  await expect(page.getByText('Live · updated just now')).toBeVisible();
  // Unpaid counter orders say so, on the timeline and at the total.
  await expect(page.getByText(/Paying at the counter/).filter({ visible: true })).toBeVisible();
  await expect(page.getByText('To pay at counter')).toBeVisible();

  await page.goto('/orders/');
  await expect(page.getByRole('link', { name: /#A105/ }).filter({ visible: true })).toContainText(
    'Preparing · 10 min',
  );
});

test('an order from another device is not found', async ({ page }) => {
  await page.goto('/order/?id=A110');
  await expect(page.getByRole('heading', { level: 1, name: 'Order not found' })).toBeVisible();
  await expect(page.getByText(/couldn't find order #A110 on this device/)).toBeVisible();
  await page.getByRole('link', { name: 'My orders' }).filter({ visible: true }).last().click();
  await expect(page).toHaveURL(/\/orders\/$/);
});

test('any order id opens from a deep link; unknown or missing ids are not found', async ({
  page,
}) => {
  // Far past the 20 ids the old pre-rendered pages allowed.
  await page.evaluate(() => {
    const order = {
      id: 'A1000',
      table: 12,
      customerName: 'Ananya Rao',
      placedBy: 'you',
      placedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      status: 'received',
      items: [
        {
          dishSlug: 'masala-chai',
          name: 'Masala Chai',
          veg: true,
          quantity: 1,
          details: [],
          unitPrice: 99,
          status: 'queued',
        },
      ],
      itemTotal: 99,
      total: 104,
      payment: { method: 'counter', status: 'unpaid' },
      timeline: [{ status: 'received', time: '7:00 PM', note: 'Pay at counter' }],
      estimate: '18–22 min',
    };
    localStorage.setItem('olive.orders.v1', JSON.stringify([order]));
  });

  await page.goto('/order/track/?id=A1000');
  await expect(page.getByText('Order status: Preparing')).toBeAttached();
  await expect(page.getByText('1 × Masala Chai')).toBeVisible();
  await page.getByRole('link', { name: 'Order #A1000 details' }).click();
  await expect(page).toHaveURL(/\/order\/\?id=A1000$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Order #A1000' })).toBeVisible();

  for (const path of ['/order/track/?id=A9999', '/order/confirmed/?id=A9999', '/order/track/']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Order not found' })).toBeVisible();
  }
});
