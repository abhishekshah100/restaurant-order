import { expect, test, type Page } from '@playwright/test';
import { dishSlug, scan, waitForSavedCart } from './helpers';

/**
 * Promotions: promo codes in the cart (applied, refused below the minimum, carried through
 * checkout to the confirmation and the receipt) and happy hour (20% off Beverages, 4–7 PM branch
 * time), with the browser clock set by Playwright. Runs at 390px and 1280px.
 */

const visible = (page: Page, role: Parameters<Page['getByRole']>[0], name: string | RegExp) =>
  page.getByRole(role, { name }).filter({ visible: true }).first();

const text = (page: Page, value: string | RegExp) =>
  page
    .getByText(value, { exact: typeof value === 'string' })
    .filter({ visible: true })
    .first();

/** Intl puts a no-break space between "रू" and the amount. */
const npr = (amount: string) => new RegExp(`^−?रू\\s${amount.replace('.', '\\.')}$`);

// 7:30 PM in Bengaluru, 7:45 PM in Kathmandu: after happy hour.
const EVENING = new Date('2026-10-08T14:00:00Z');
// 5:00 PM in Bengaluru, 5:15 PM in Kathmandu: happy hour.
const HAPPY_HOUR = new Date('2026-10-08T11:30:00Z');

async function addDish(page: Page, category: string, dish: string) {
  await page.goto(`/menu/${category}/`);
  const stepper = page.getByRole('group', { name: `Quantity of ${dish}` }).first();
  await expect(async () => {
    if (!(await stepper.isVisible())) {
      await page.getByRole('button', { name: `Add ${dish}` }).click({ timeout: 2000 });
    }
    await expect(stepper).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await waitForSavedCart(page, dishSlug(dish));
}

/** The bill summary row with this label (the visible one). */
const billRow = (page: Page, label: string | RegExp) =>
  page.locator('dl > div').filter({ visible: true }).filter({ hasText: label }).first();

async function applyCode(page: Page, code: string) {
  await visible(page, 'button', 'Apply promo code').click();
  await page.getByRole('textbox', { name: 'Promo code' }).fill(code);
  await visible(page, 'button', /^Apply$/).click();
}

test.beforeEach(async ({ page }) => {
  await scan(page, 'table=7');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('India: WELCOME10 off the cart, through checkout to the receipt', async ({ page }) => {
  test.slow();
  await page.clock.install({ time: EVENING });
  await scan(page, 'table=12');
  await addDish(page, 'mains', 'Dal Makhani');
  await addDish(page, 'mains', 'Palak Paneer');

  await page.goto('/cart/');
  await visible(page, 'button', 'Apply promo code').click();
  // The outlet's codes for dine-in: WELCOME10 (FLAT50 is for delivery).
  await expect(text(page, '10% off orders above ₹299, up to ₹100')).toBeVisible();
  await expect(visible(page, 'button', 'Apply FLAT50')).toHaveCount(0);
  await visible(page, 'button', 'Apply WELCOME10').click();
  await expect(text(page, 'WELCOME10 applied')).toBeVisible();
  await expect(text(page, 'You save ₹64.80 on this order')).toBeVisible();

  // ₹648 − ₹64.80 = ₹583.20 + GST 5% ₹29.16 = ₹612.36 → ₹612.
  await expect(billRow(page, 'Promo WELCOME10')).toContainText('−₹64.80');
  await expect(billRow(page, 'CGST (2.5%)')).toContainText('₹14.58');
  await expect(billRow(page, 'To pay')).toContainText('₹612');

  await page.goto('/checkout/details/');
  await page.getByLabel('Full name').fill('Ananya Rao');
  await page.getByLabel('Mobile number').fill('9876543210');
  await visible(page, 'button', 'Send OTP').click();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await visible(page, 'button', 'Verify & continue').click();
  await expect(page).toHaveURL(/\/checkout\/payment\/$/);
  await expect(billRow(page, 'Promo WELCOME10')).toContainText('−₹64.80');
  await page.getByRole('radio', { name: /Pay at the counter/ }).click();
  await visible(page, 'button', 'Place order · ₹612').click();

  await expect(page).toHaveURL(/\/order\/confirmed\/\?id=A\d+$/);
  await expect(text(page, 'You saved ₹64.80 with WELCOME10')).toBeVisible();
  const id = new URL(page.url()).searchParams.get('id');
  await page.goto(`/order/?id=${id}`);
  await expect(billRow(page, 'Promo WELCOME10')).toContainText('−₹64.80');
  await expect(billRow(page, /^Total/)).toContainText('₹612');
});

test('India: a code below its minimum says how much more to add', async ({ page }) => {
  await page.clock.install({ time: EVENING });
  await scan(page, 'table=12');
  await addDish(page, 'starters', 'Dahi Kebab');
  await page.goto('/cart/');
  await applyCode(page, 'welcome10');
  // ₹289: ₹10 short of ₹299.
  await expect(
    page.getByRole('alert').filter({ hasText: 'Add ₹10 more to use WELCOME10.' }),
  ).toBeVisible();
  await expect(billRow(page, 'To pay')).toContainText('₹303');
  await page.getByRole('textbox', { name: 'Promo code' }).fill('FLAT50');
  await visible(page, 'button', /^Apply$/).click();
  await expect(
    page.getByRole('alert').filter({ hasText: "FLAT50 can't be used on dine-in orders." }),
  ).toBeVisible();
});

test('Nepal: NAMASTE15 with the service charge and VAT on the discounted items', async ({
  page,
}) => {
  await page.clock.install({ time: EVENING });
  await scan(page, 'branch=ktm-thamel&table=5');
  await addDish(page, 'mains', 'Dal Makhani');
  await page.goto('/cart/');
  await applyCode(page, 'NAMASTE15');
  await expect(text(page, 'NAMASTE15 applied')).toBeVisible();
  // रू 480 − 72 = 408; service 10% = 40.80; VAT 13% of 448.80 = 58.34; 507.14 → रू 507.
  await expect(billRow(page, 'Promo NAMASTE15').locator('dd')).toHaveText(npr('72.00'));
  await expect(billRow(page, 'Service charge (10%)').locator('dd')).toHaveText(npr('40.80'));
  await expect(billRow(page, 'VAT (13%)').locator('dd')).toHaveText(npr('58.34'));
  await expect(billRow(page, 'To pay').locator('dd')).toHaveText(npr('507'));

  // Removing it puts the bill back: 480 + 48 + 68.64 = रू 596.64 → रू 597.
  await visible(page, 'button', 'Remove promo code NAMASTE15').click();
  await expect(page.getByRole('textbox', { name: 'Promo code' })).toBeFocused();
  await expect(billRow(page, 'To pay').locator('dd')).toHaveText(npr('597'));
});

test('happy hour: drinks at 20% off inside the window (India, branch time)', async ({ page }) => {
  await page.clock.install({ time: HAPPY_HOUR });
  await scan(page, 'table=12');
  await page.goto('/menu/');
  await expect(text(page, /20% off drinks till 7:00 PM/)).toBeVisible();

  await addDish(page, 'beverages', 'Cold Coffee');
  // ₹179 − 20% (₹36, to the rupee) = ₹143.
  const coffee = page.getByRole('listitem').filter({ hasText: 'Cold Coffee' }).first();
  await expect(coffee.getByText('₹143, was ₹179')).toHaveCount(1);
  await expect(coffee.getByText('Happy hour')).toBeVisible();
  await page.goto('/cart/');
  await expect(billRow(page, 'Happy hour')).toContainText('−₹36.00');
  // ₹143 + GST ₹7.15 = ₹150.15 → ₹150.
  await expect(billRow(page, 'To pay')).toContainText('₹150');
});

test('happy hour: Nepal prices at 4:05 PM in Kathmandu', async ({ page }) => {
  // 10:20 UTC is 4:05 PM in Kathmandu (+5:45), 3:50 PM in Bengaluru.
  await page.clock.install({ time: new Date('2026-10-08T10:20:00Z') });
  await scan(page, 'branch=ktm-thamel&table=5');
  await page.goto('/menu/beverages/');
  // रू 285 − 57 = रू 228.
  const coffee = page.getByRole('listitem').filter({ hasText: 'Cold Coffee' }).first();
  await expect(coffee.getByText(/^रू\s228, was रू\s285$/)).toHaveCount(1);
});

test('no happy-hour pricing outside the window', async ({ page }) => {
  await page.clock.install({ time: EVENING });
  await scan(page, 'table=12');
  await page.goto('/menu/beverages/');
  await expect(page.getByText(/Happy hour/)).toHaveCount(0);
  await expect(text(page, '₹179')).toBeVisible();
  await addDish(page, 'beverages', 'Cold Coffee');
  await page.goto('/cart/');
  await expect(page.locator('dl > div').filter({ hasText: 'Happy hour' })).toHaveCount(0);
  await expect(billRow(page, 'To pay')).toContainText('₹188'); // ₹179 + ₹8.95
});
