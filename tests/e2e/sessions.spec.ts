import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { dishSlug, waitForSavedCart, scan } from './helpers';

/**
 * Guest sessions: every guest who scans a table's QR code gets their own session, so two
 * people at one table keep separate carts. Each browser context is a separate phone.
 * Runs at a mobile (390px) and a desktop (1280px) viewport — see playwright.config.ts.
 */

/** A separate guest's phone, at this project's viewport. */
async function newGuest(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const { baseURL, viewport } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport });
  return context.newPage();
}

const tableLabel = (page: Page, table: number) =>
  page.getByText(`Table ${table}`).filter({ visible: true }).first();

async function scanAndAdd(page: Page, dish: string) {
  await scan(page, 'table=12');
  await expect(tableLabel(page, 12)).toBeVisible();
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
  await waitForSavedCart(page, dishSlug(dish));
}

/** Cart lines have a quantity stepper named after the dish. */
const cartLine = (page: Page, dish: string) =>
  page.getByRole('group', { name: `Quantity of ${dish}` }).filter({ visible: true });

async function expectCartWith(page: Page, mine: string, theirs: string) {
  await page.goto('/cart/');
  await expect(cartLine(page, mine).first()).toBeVisible();
  await expect(cartLine(page, theirs)).toHaveCount(0);
}

test('two guests at one table keep separate carts', async ({ browser }, testInfo) => {
  const ananya = await newGuest(browser, testInfo);
  const rohan = await newGuest(browser, testInfo);

  await scanAndAdd(ananya, 'Dahi Kebab');
  await scanAndAdd(rohan, 'Hara Bhara Kebab');

  await expectCartWith(ananya, 'Dahi Kebab', 'Hara Bhara Kebab');
  await expectCartWith(rohan, 'Hara Bhara Kebab', 'Dahi Kebab');

  // Scanning another table's code starts a new session there, with an empty cart.
  await scan(ananya, 'table=5');
  await expect(tableLabel(ananya, 5)).toBeVisible();
  await ananya.goto('/cart/');
  await expect(ananya.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await expect(tableLabel(ananya, 5)).toBeVisible();

  await Promise.all([ananya.context().close(), rohan.context().close()]);
});

test('a scanned table never shows the default table first', async ({ page }) => {
  // Slow the scripts so the prerendered HTML stays on screen before React reads the link.
  await page.route('**/*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.addInitScript(() => {
    const seen = new Set<string>();
    (window as unknown as { tableLabels: Set<string> }).tableLabels = seen;
    const collect = () =>
      document.querySelectorAll('body *').forEach((el) => {
        const text = el.children.length === 0 ? el.textContent?.trim() : undefined;
        if (text && /^Table\b/.test(text)) seen.add(text);
      });
    new MutationObserver(collect).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });

  await page.goto('/?table=3');
  await expect(page.getByText('Table 3').filter({ visible: true }).first()).toBeVisible();
  const labels = await page.evaluate(() => [
    ...(window as unknown as { tableLabels: Set<string> }).tableLabels,
  ]);
  // Before the link is read the pill shows a placeholder, never the default table 12.
  expect(labels).not.toContain('Table 12');
  expect(labels).toContain('Table 3');
});
