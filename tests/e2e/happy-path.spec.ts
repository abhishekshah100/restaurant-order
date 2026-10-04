import { expect, test, type Page } from '@playwright/test';
import { waitForSavedCart } from './helpers';

/**
 * Happy path: menu → dish → cart → checkout → confirmation.
 * Runs at a mobile (390px) and a desktop (1280px) viewport — see playwright.config.ts.
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

test.beforeEach(async ({ page }) => {
  await page.goto('/?table=7');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('order a dish and pay online', async ({ page }) => {
  // Welcome reads the table from the QR link.
  await page.goto('/?table=7');
  await expect(page.getByText('Table 7').filter({ visible: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'View menu' }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/menu\/$/);

  // A simple dish adds straight away and shows an Undo toast.
  await page.getByRole('button', { name: 'Add Dahi Kebab' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Dahi Kebab added' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Quantity of Dahi Kebab' }).first()).toBeVisible();

  // Food detail: pick a size and an add-on, watch the live total.
  await page.getByRole('link', { name: 'Truffle Mushroom Pasta' }).first().click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Truffle Mushroom Pasta' }),
  ).toBeVisible();
  // The photo opens full size in a pop-up and closes with Esc.
  await page
    .getByRole('button', { name: 'View photo of Truffle Mushroom Pasta' })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Photo: Truffle Mushroom Pasta' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Photo: Truffle Mushroom Pasta' })).toBeHidden();
  await page.getByRole('radio', { name: /Large/ }).click();
  await page.getByRole('checkbox', { name: /Extra parmesan/ }).click();
  await page.getByRole('button', { name: 'Less cheese' }).click();
  const addToCart = page.getByRole('button', { name: /Add to cart/ });
  await expect(addToCart).toContainText('₹509');
  await addToCart.click();

  // Cart
  await page.goto('/cart/');
  await expect(page.getByText('Large · Extra parmesan (+₹40)').first()).toBeVisible();
  await expect(page.getByText('“Less cheese”').filter({ visible: true }).first()).toBeVisible();
  // 289 + 509 = 798 → +5% GST = 837.90 → ₹838
  await expect(page.getByText('₹838').filter({ visible: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Checkout' }).filter({ visible: true }).click();

  // Details — validation first
  await expect(page).toHaveURL(/\/checkout\/details\/$/);
  await page.getByRole('button', { name: 'Send OTP' }).filter({ visible: true }).click();
  await expect(page.getByText('Please enter your name')).toBeVisible();
  await page.getByLabel('Full name').fill('Ananya Rao');
  await page.getByLabel('Mobile number').fill('9876543210');
  await page.getByRole('button', { name: 'Send OTP' }).filter({ visible: true }).click();

  // OTP — a wrong code first, then the mock code
  await expect(page).toHaveURL(/\/checkout\/verify\/$/);
  await expect(page.getByText('98765 43210').filter({ visible: true }).first()).toBeVisible();
  await page.getByLabel('Digit 1 of 6').fill('111111');
  await page.getByRole('button', { name: 'Verify & continue' }).filter({ visible: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '2 attempts left' })).toBeVisible();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await page.getByRole('button', { name: 'Verify & continue' }).filter({ visible: true }).click();

  // Payment
  await expect(page).toHaveURL(/\/checkout\/payment\/$/);
  await expect(page.getByRole('radio', { name: /Pay online now/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Pay ₹838' }).filter({ visible: true }).click();

  // Processing → simulate success
  await expect(page).toHaveURL(/\/checkout\/processing\/$/);
  await expect(page.getByRole('heading', { name: 'Confirming your payment' })).toBeVisible();
  await page.getByRole('button', { name: 'Prototype: success' }).filter({ visible: true }).click();

  // Confirmation
  await expect(page).toHaveURL(/\/order\/A105\/confirmed\/$/);
  await expect(page.getByRole('heading', { name: 'Order #A105' })).toBeVisible();
  await expect(page.getByText('Paid online').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Table 7').filter({ visible: true }).first()).toBeVisible();

  // The cart is emptied only after success.
  await page.goto('/cart/');
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});

test('a failed payment keeps the cart', async ({ page }) => {
  await page.goto('/menu/');
  await page.getByRole('button', { name: 'Add Dahi Kebab' }).click();
  // Wait until the cart has registered the item (it's saved to the device right after).
  await expect(page.getByRole('status').filter({ hasText: 'Dahi Kebab added' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Quantity of Dahi Kebab' }).first()).toBeVisible();
  await waitForSavedCart(page, 'dahi-kebab');
  await page.goto('/checkout/details/');
  await page.getByLabel('Full name').fill('Ananya Rao');
  await page.getByLabel('Mobile number').fill('9876543210');
  await page.getByRole('button', { name: 'Send OTP' }).filter({ visible: true }).click();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await page.getByRole('button', { name: 'Verify & continue' }).filter({ visible: true }).click();
  await page
    .getByRole('button', { name: /^Pay ₹/ })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Prototype: failure' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: "Payment didn't go through" })).toBeVisible();
  await page.getByRole('link', { name: 'Back to order' }).filter({ visible: true }).click();
  await expect(page.getByText('Dahi Kebab').filter({ visible: true }).first()).toBeVisible();
});

test('quick-add opens for a dish without a photo', async ({ page }) => {
  await page.goto('/menu/');
  await page.getByRole('button', { name: 'Add Paneer Tikka' }).click();
  const dialog = page.getByRole('dialog', { name: 'Paneer Tikka' });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('radio', { name: /Full · 10 pcs/ })
    .filter({ visible: true })
    .click();
  await dialog.getByRole('radio', { name: 'Medium' }).click();
  await dialog.getByRole('checkbox', { name: /Extra mint chutney/ }).click();
  await expect(dialog.getByRole('button', { name: /Add to cart/ })).toContainText('₹549');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Add Paneer Tikka' }).click();
  await page
    .getByRole('dialog', { name: 'Paneer Tikka' })
    .getByRole('button', { name: /Add to cart/ })
    .click();
  if (isDesktop(page)) {
    await expect(
      page.getByRole('complementary', { name: 'Your cart' }).getByText('Paneer Tikka'),
    ).toBeVisible();
  } else {
    await expect(page.getByRole('link', { name: /View cart, 1 item/ })).toBeVisible();
  }
});
