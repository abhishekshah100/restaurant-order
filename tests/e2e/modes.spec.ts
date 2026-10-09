import { expect, test, type Page } from '@playwright/test';
import { scan, waitForSavedCart } from './helpers';

/**
 * Order modes: takeaway and delivery from the start screen (no table QR code), the delivery
 * area, fee and minimum order, mode-specific checkout and tracking, and switching mode or
 * outlet. Runs at 390px and 1280px, with the clock at 7:00 PM in Bengaluru (7:15 PM in
 * Kathmandu) so pickup slots are on offer.
 */

const visible = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name }).filter({ visible: true });

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-03T13:30:00Z') });
});

async function verify(page: Page, name: string, phone: string) {
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Mobile number').fill(phone);
  await visible(page, 'Send OTP').click();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await visible(page, 'Verify & continue').click();
  await expect(page).toHaveURL(/\/checkout\/payment\/$/);
}

test('India takeaway, as soon as possible, paid at pickup', async ({ page }) => {
  // A takeaway link without an outlet: the start screen, with takeaway chosen.
  await page.goto('/?mode=takeaway');
  await expect(
    page.getByRole('heading', { level: 1, name: 'How would you like to order?' }),
  ).toBeVisible();
  await page.locator('[data-branch="blr-indiranagar"]').click();
  await expect(page.getByRole('radio', { name: /^Dine-in/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(page.getByRole('radio', { name: /^Takeaway/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await visible(page, 'Continue with Takeaway').click();
  await expect(page).toHaveURL(/\/menu\/$/);
  await expect(visible(page, /Takeaway from Indiranagar/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Add Dahi Kebab' }).click();
  await waitForSavedCart(page, 'dahi-kebab');
  await page.goto('/cart/');
  await expect(
    page
      .getByText(/Ready for pickup (in )?about 20 min/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Checkout' }).filter({ visible: true }).click();

  await expect(page.getByRole('radio', { name: /As soon as possible/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByText('Ready around 7:20 PM')).toBeVisible();
  await verify(page, 'Ananya Rao', '9876543210');

  // Takeaway's methods: online or at pickup (no "pay at the counter" at a table).
  await expect(page.getByRole('radio', { name: /Pay at the counter/ })).toHaveCount(0);
  await page.getByRole('radio', { name: /Pay at pickup/ }).click();
  await visible(page, /^Place order · ₹303$/).click();

  await expect(page).toHaveURL(/\/order\/confirmed\/\?id=A105$/);
  await expect(page.getByText('Pickup at').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('7:20 PM').filter({ visible: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Track order' }).filter({ visible: true }).click();
  await expect(page.getByText('Ready for pickup at')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pickup from' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Get directions/ })).toHaveAttribute(
    'href',
    /google\.com\/maps\/search/,
  );
  // No table service for takeaway.
  await expect(visible(page, 'Call waiter')).toHaveCount(0);
});

test('Nepal delivery: zone fee, minimum order, eSewa and tracking to out for delivery', async ({
  page,
}) => {
  await page.goto('/?branch=ktm-thamel&mode=delivery');
  await expect(page.getByText('Delivery', { exact: true }).first()).toBeVisible();
  await page.goto('/menu/starters/');
  await expect(visible(page, /Delivery from Thamel/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add Dahi Kebab' }).click();
  await waitForSavedCart(page, 'dahi-kebab');

  await page.goto('/cart/');
  const checkout = page.getByRole('link', { name: 'Checkout' }).filter({ visible: true });
  await expect(checkout).toHaveAttribute('aria-disabled', 'true');
  await page.getByLabel('Deliver to').selectOption('Lazimpat');
  await expect(page.getByText('Thamel & Lazimpat · arrives in about 35 min')).toBeVisible();
  await expect(page.getByText('Delivery fee').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('रू 60.00').filter({ visible: true }).first()).toBeVisible();
  // रू 460 of a रू 800 minimum.
  await expect(page.getByText('Add रू 340 more to check out')).toBeVisible();
  await expect(checkout).toHaveAttribute('aria-disabled', 'true');

  await page
    .getByRole('button', { name: 'Add one Dahi Kebab' })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByText('Add रू 340 more to check out')).toHaveCount(0);
  await expect(checkout).not.toHaveAttribute('aria-disabled');
  await checkout.click();

  await expect(page.locator('#address-area')).toHaveValue('Lazimpat');
  await page.getByLabel('Full name').fill('Sita Sharma');
  await page.getByLabel('Mobile number').fill('9841234567');
  await visible(page, 'Send OTP').click();
  // The address is required.
  await expect(page.getByText('Enter your house or flat and street')).toBeVisible();
  await page.getByLabel('House / flat and street').fill('Flat 3B, 12 Lake Road');
  await visible(page, 'Send OTP').click();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await visible(page, 'Verify & continue').click();

  await expect(page.getByRole('radio', { name: /Cash on delivery/ })).toBeVisible();
  await page.getByRole('radio', { name: /eSewa/ }).click();
  // 2 × 460 = 920 + fee 60 + service 92 + VAT 131.56 = 1,203.56 → रू 1,204
  await visible(page, 'Pay रू 1,204').click();
  await visible(page, 'Prototype: success').click();
  await expect(page).toHaveURL(/\/order\/confirmed\/\?id=A105$/);
  await expect(page.getByText('Deliver to').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('Lazimpat').filter({ visible: true }).first()).toBeVisible();

  // The rider sets off 25 minutes after the order.
  await page.clock.fastForward('26:00');
  await page.goto('/order/track/?id=A105');
  await expect(page.getByText('Out for delivery').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Arriving in about')).toBeVisible();
  await expect(page.getByRole('link', { name: /Call .*, your rider/ })).toHaveAttribute(
    'href',
    /^tel:/,
  );

  await page.goto('/order/?id=A105');
  await expect(page.getByText('Delivery fee').filter({ visible: true }).first()).toBeVisible();
  await page.goto('/orders/');
  await expect(
    page.getByText('Delivery', { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
});

test('switching mode at the same outlet keeps the cart', async ({ page }) => {
  await scan(page, 'table=12');
  await page.goto('/menu/starters/');
  await page.getByRole('button', { name: 'Add Dahi Kebab' }).click();
  await waitForSavedCart(page, 'dahi-kebab');

  // From dine-in to takeaway on the start screen: dine-in stays available (the table was scanned).
  await page.goto('/start/');
  await expect(page.getByRole('radio', { name: /^Dine-in/ })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.getByRole('radio', { name: /^Takeaway/ }).click();
  await visible(page, 'Continue with Takeaway').click();
  await expect(page).toHaveURL(/\/menu\/$/);

  // From takeaway to delivery in the header.
  await visible(page, /Takeaway from Indiranagar/)
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'How would you like to order?' });
  await dialog.getByRole('radio', { name: /^Delivery/ }).click();
  await expect(page.getByText('Now ordering delivery. Your cart is kept.')).toBeVisible();
  await expect(visible(page, /Delivery from Indiranagar/).first()).toBeVisible();

  await page.goto('/cart/');
  await expect(page.getByText('Dahi Kebab').filter({ visible: true }).first()).toBeVisible();
});

test('switching outlet empties the cart, after asking', async ({ page }) => {
  await page.goto('/?branch=blr-indiranagar&mode=takeaway');
  await expect(page.getByText('Takeaway', { exact: true }).first()).toBeVisible();
  await page.goto('/menu/starters/');
  await expect(visible(page, /Takeaway from Indiranagar/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add Dahi Kebab' }).click();
  await waitForSavedCart(page, 'dahi-kebab');

  await page.goto('/start/');
  await page.locator('[data-branch="ktm-thamel"]').click();
  await page.getByRole('radio', { name: /^Takeaway/ }).click();
  await visible(page, 'Continue with Takeaway').click();
  const confirm = page.getByRole('dialog', { name: 'Switch to Thamel?' });
  await expect(confirm).toContainText('your cart (1 item) will be emptied');
  // Keeping the cart stays put.
  await confirm.getByRole('button', { name: 'Keep my cart' }).click();
  await expect(page).toHaveURL(/\/start\/$/);

  await visible(page, 'Continue with Takeaway').click();
  await page.getByRole('button', { name: 'Switch and empty cart' }).click();
  await expect(page).toHaveURL(/\/menu\/$/);
  await expect(visible(page, /Takeaway from Thamel/).first()).toBeVisible();
  await page.goto('/cart/');
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});
