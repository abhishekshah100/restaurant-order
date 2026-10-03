import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

/**
 * Separate bills: two guests at one table order and pay separately. Ananya pays online at
 * checkout; Rohan pays at the counter, then settles his own bill in the app from the bill page.
 * Each browser context is a separate phone. Runs at a mobile (390px) and a desktop (1280px)
 * viewport — see playwright.config.ts.
 *
 * Table 12 also has the drawn mock orders (#A104, #A097, #A101) from GET /orders. They carry no
 * guest session, so they're on the whole table's bill but never on one guest's own bill.
 * Order IDs come from a pool per device, so both phones may get #A105: don't compare IDs.
 */

/** A separate guest's phone, at this project's viewport, scanned in at table 12. */
async function newGuest(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const { baseURL, viewport } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport });
  const page = await context.newPage();
  await page.goto('/?table=12');
  await expect(page.getByText('Table 12').filter({ visible: true }).first()).toBeVisible();
  return page;
}

const visible = (page: Page, role: Parameters<Page['getByRole']>[0], name: string | RegExp) =>
  page.getByRole(role, { name }).filter({ visible: true }).first();

/** The "Balance due" row (term + amount) of the visible bill summary. */
const balanceDue = (page: Page) =>
  page.getByText('Balance due', { exact: true }).filter({ visible: true }).first().locator('..');

/** An order row on the bill, found by its amount. */
const billRow = (page: Page, amount: string) =>
  page.getByRole('listitem').filter({ hasText: amount });

/** "Paid" also matches inside "Unpaid", so check both. */
async function expectPaid(row: ReturnType<typeof billRow>) {
  await expect(row).toContainText('Paid');
  await expect(row).not.toContainText('Unpaid');
}

const payNow = (page: Page) => page.getByRole('link', { name: /^Pay ₹[\d,]+ now$/ });

async function orderAndCheckout(page: Page, dish: string, name: string, pay: 'online' | 'counter') {
  await page.goto('/menu/starters/');
  // Wait until the cart has registered the item (it's saved to the device right after). On a
  // busy machine the first tap can land before the page has hydrated, so tap again if needed.
  const stepper = page.getByRole('group', { name: `Quantity of ${dish}` }).first();
  await expect(async () => {
    if (!(await stepper.isVisible())) {
      await page.getByRole('button', { name: `Add ${dish}` }).click({ timeout: 2000 });
    }
    await expect(stepper).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await page.goto('/checkout/details/');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Mobile number').fill('9876543210');
  await visible(page, 'button', 'Send OTP').click();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await visible(page, 'button', 'Verify & continue').click();
  await expect(page).toHaveURL(/\/checkout\/payment\/$/);
  if (pay === 'online') {
    await visible(page, 'button', /^Pay ₹/).click();
    await visible(page, 'button', 'Prototype: success').click();
  } else {
    await page.getByRole('radio', { name: /Pay at the counter/ }).click();
    await visible(page, 'button', /^Place order/).click();
  }
  await expect(page).toHaveURL(/\/order\/A\d+\/confirmed\/$/);
}

async function openMyBill(page: Page) {
  await page.goto('/help/bill/');
  await page.getByRole('radio', { name: /Just my orders/ }).click();
  await expect(page.getByRole('radio', { name: /Just my orders/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

test('two guests at one table pay separate bills', async ({ browser }, testInfo) => {
  // Two phones, two checkouts and a payment: give it the slow-test budget.
  test.slow();
  const ananya = await newGuest(browser, testInfo);
  const rohan = await newGuest(browser, testInfo);

  // Dahi Kebab ₹289 + 5% GST = ₹303 (paid online) · Hara Bhara Kebab ₹259 + 5% = ₹272 (counter).
  await orderAndCheckout(ananya, 'Dahi Kebab', 'Ananya Rao', 'online');
  await orderAndCheckout(rohan, 'Hara Bhara Kebab', 'Rohan Mehta', 'counter');

  // Rohan's bill: his own order, unpaid, and nothing of Ananya's.
  await openMyBill(rohan);
  await expect(billRow(rohan, '₹272')).toContainText('Unpaid');
  await expect(billRow(rohan, '₹303')).toHaveCount(0);
  await expect(balanceDue(rohan)).toContainText('₹272');

  // The whole table's bill can't be paid in the app.
  await rohan.getByRole('radio', { name: /Whole table/ }).click();
  await expect(payNow(rohan)).toHaveCount(0);
  await rohan.getByRole('radio', { name: /Just my orders/ }).click();

  // Pay only what this phone ordered.
  await payNow(rohan).filter({ visible: true }).first().click();
  await expect(rohan).toHaveURL(/\/help\/bill\/pay\/$/);
  await expect(billRow(rohan, '₹272')).toContainText('Unpaid');
  await expect(rohan.getByRole('radio', { name: /UPI/ })).toHaveAttribute('aria-checked', 'true');
  await visible(rohan, 'button', 'Pay ₹272').click();

  await expect(rohan.getByRole('heading', { name: 'Confirming your payment' })).toBeVisible();
  await expect(rohan.getByRole('heading', { name: 'Confirming your payment' })).toBeFocused();
  await visible(rohan, 'button', 'Prototype: success').click();

  await expect(rohan.getByRole('heading', { level: 1, name: 'Bill paid' })).toBeVisible();
  const receipt = rohan.getByRole('definition');
  await expect(receipt.filter({ hasText: '₹272' })).toBeVisible();
  await expect(receipt.filter({ hasText: 'UPI' })).toBeVisible();
  await expect(visible(rohan, 'link', 'View my orders')).toHaveAttribute('href', '/orders/');

  // His bill now shows the order paid and nothing more to pay in the app.
  await openMyBill(rohan);
  await expectPaid(billRow(rohan, '₹272'));
  await expect(balanceDue(rohan)).toContainText('₹0');
  await expect(payNow(rohan)).toHaveCount(0);
  await rohan.goto('/help/bill/pay/');
  await expect(rohan.getByRole('heading', { level: 1, name: 'Nothing to pay' })).toBeVisible();

  // Ananya's bill: her own order, already paid, nothing of Rohan's and no Pay button.
  await openMyBill(ananya);
  await expectPaid(billRow(ananya, '₹303'));
  await expect(billRow(ananya, '₹272')).toHaveCount(0);
  await expect(payNow(ananya)).toHaveCount(0);

  await Promise.all([ananya.context().close(), rohan.context().close()]);
});

test('a failed bill payment keeps the orders unpaid and can be retried', async ({
  browser,
}, testInfo) => {
  const rohan = await newGuest(browser, testInfo);
  await orderAndCheckout(rohan, 'Hara Bhara Kebab', 'Rohan Mehta', 'counter');

  await rohan.goto('/help/bill/pay/');
  await rohan.getByRole('radio', { name: /card/ }).click();
  await visible(rohan, 'button', 'Pay ₹272').click();
  await visible(rohan, 'button', 'Prototype: failure').click();
  await expect(
    rohan.getByRole('alert').filter({ hasText: "Payment didn't go through" }),
  ).toBeVisible();

  // Nothing was paid.
  await visible(rohan, 'link', 'Back to bill').click();
  await rohan.getByRole('radio', { name: /Just my orders/ }).click();
  await expect(billRow(rohan, '₹272')).toContainText('Unpaid');

  await payNow(rohan).filter({ visible: true }).first().click();
  await visible(rohan, 'button', 'Pay ₹272').click();
  await visible(rohan, 'button', 'Prototype: failure').click();
  await visible(rohan, 'button', 'Try again · ₹272').click();
  await visible(rohan, 'button', 'Prototype: success').click();
  await expect(rohan.getByRole('heading', { level: 1, name: 'Bill paid' })).toBeVisible();

  await rohan.context().close();
});
