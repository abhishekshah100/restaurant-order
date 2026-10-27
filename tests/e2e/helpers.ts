import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';

/**
 * The site in out/ was built with NEXT_PUBLIC_BACKEND_URL (`E2E_BACKEND=true npx playwright
 * test`): what restaurant-backend serves goes to it. A check that needs a module the backend
 * doesn't have yet runs on the mock only.
 */
export const againstBackend = process.env.E2E_BACKEND === 'true';

/* ---------- One clock for the browser and the server ---------- */

/** The backend the site was built against (its test clock is on: TEST_CLOCK=true). */
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:4001/v1';

async function serverClock(path: '' | '/advance', method: 'PUT' | 'POST', body: object) {
  if (!againstBackend) return;
  const res = await fetch(`${BACKEND_URL}/test/clock${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`The backend's test clock answered ${res.status}`);
}

/** "18:30" (mm:ss) or "01:02:05" → ms, as page.clock.fastForward reads it. */
const durationMs = (duration: string) =>
  duration
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0) * 1000;

/**
 * Where every test starts on the clock: Thursday 15 Oct 2026, 1:00 PM in India (1:15 PM in
 * Nepal), inside every demo branch's opening hours, so a test that orders passes whenever it
 * runs (branches take orders only inside their sessions, until last orders).
 */
export const LUNCHTIME = new Date('2026-10-15T07:30:00Z');

/**
 * Every page in the context starts with its Date moved to lunchtime and running on; timers are
 * left alone (a test that needs them installs the clock: installClock). For contexts a test
 * opens itself (a second guest's phone).
 */
export async function startAtLunchtime(context: BrowserContext) {
  // One offset for the whole test (set here, not per page), so time runs on across page loads.
  await context.addInitScript((offset: number) => {
    const RealDate = Date;
    (window as { e2eRealDate?: DateConstructor }).e2eRealDate = RealDate;
    class LunchDate extends RealDate {
      constructor(...args: ConstructorParameters<DateConstructor> | []) {
        if (args.length === 0) super(RealDate.now() + offset);
        else super(...(args as [number]));
      }
      static now() {
        return RealDate.now() + offset;
      }
    }
    window.Date = LunchDate as DateConstructor;
  }, LUNCHTIME.getTime() - Date.now());
}

/**
 * The tests' `test`: each starts at lunchtime, in the browser and (against the backend) on the
 * server, whose clock goes back to the real time afterwards. Specs import it from here, so the
 * fixture holds in every file (a hook in this module would only reach the first that loads it).
 */
export const test = base.extend<{ lunchtime: void }>({
  lunchtime: [
    async ({ context }, use) => {
      await startAtLunchtime(context);
      await serverClock('', 'PUT', { now: LUNCHTIME.toISOString() });
      await use();
      await serverClock('', 'PUT', { now: null });
    },
    { auto: true },
  ],
});

export { expect };

/**
 * The browser's clock at `time` (running on; lunchtime when none), and the server's too against
 * the backend, so what the server works out from "now" (pickup times, bookings, offers) agrees
 * with the page.
 */
export async function installClock(page: Page, time: Date = LUNCHTIME) {
  // Playwright's clock takes over from the lunchtime Date: the real one goes back first (init
  // scripts run in the order they're added), so the two don't stack.
  await page.context().addInitScript(() => {
    const real = (window as { e2eRealDate?: DateConstructor }).e2eRealDate;
    if (real) window.Date = real;
  });
  await page.clock.install({ time });
  await serverClock('', 'PUT', { now: time.toISOString() });
}

/** Both clocks jump ahead ("18:30": 18 minutes 30 seconds). */
export async function fastForward(page: Page, duration: string) {
  await page.clock.fastForward(duration);
  await serverClock('/advance', 'POST', { ms: durationMs(duration) });
}

/** The browser's clock stopped at `time`; the server's set to it. */
export async function fixClock(page: Page, time: Date) {
  await page.clock.setFixedTime(time);
  await serverClock('', 'PUT', { now: time.toISOString() });
}

/**
 * Waits until the cart holding this dish is saved on the device. A new guest session is opened
 * by the server (POST /sessions, a few hundred ms with the mock), and the cart is saved once
 * it's there; a full page load before that would start over.
 */
export async function waitForSavedCart(page: Page, dishSlug: string) {
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('olive.cart.v2') ?? ''))
    .toContain(`"dishSlug":"${dishSlug}"`);
}

/** The menu slug of a dish name as these tests use them: "Hara Bhara Kebab" → "hara-bhara-kebab". */
export const dishSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

/**
 * Opens a table QR link (`scan(page, 'table=12')`, `scan(page, 'branch=ktm-thamel&table=5')`)
 * and waits until its guest session is saved, so the next page load goes on with it (without a
 * session, pages send the guest to the start screen).
 */
export async function scan(page: Page, query: string) {
  await page.goto(`/?${query}`);
  const table = new URLSearchParams(query).get('table');
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('olive.session.v1') ?? ''))
    .toContain(`"table":${table}`);
}

/** The first visible element with this role and name (mobile and desktop render both). */
export const visible = (
  page: Page,
  role: Parameters<Page['getByRole']>[0],
  name: string | RegExp,
) => page.getByRole(role, { name }).filter({ visible: true }).first();

/** Adds a dish from its category page and waits for the cart to be saved. */
export async function addDish(page: Page, category: string, dish: string) {
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

/** Places the cart at the counter; returns the order number. */
export async function orderAtCounter(page: Page): Promise<string> {
  await page.goto('/checkout/details/');
  await page.getByLabel('Full name').fill('Ananya Rao');
  await page.getByLabel('Mobile number').fill('9876543210');
  await visible(page, 'button', 'Send OTP').click();
  await page.getByLabel('Digit 1 of 6').fill('123456');
  await visible(page, 'button', 'Verify & continue').click();
  await page.getByRole('radio', { name: /Pay at the counter/ }).click();
  await visible(page, 'button', /^Place order/).click();
  await expect(page).toHaveURL(/\/order\/confirmed\/\?id=[A-Z]+-?\d+$/);
  return new URL(page.url()).searchParams.get('id') ?? '';
}

/** Calls a waiter from Help: needs water, with a note. */
export async function callWaiter(page: Page) {
  await page.goto('/help/');
  await visible(page, 'button', /Call (a )?waiter/).click();
  const dialog = page.getByRole('dialog', { name: 'Need assistance?' });
  await dialog.getByRole('radio', { name: 'Need water' }).click();
  await dialog.getByLabel(/Add a note/).fill('No ice, please');
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL(/\/help\/waiter-requested\/$/);
}

/** Signs in with the demo admin and picks a branch. */
export async function adminSignIn(page: Page, branch = 'Udyog Vihar') {
  await page.goto('/admin/login/');
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/select-branch\/$/);
  await page.getByRole('button', { name: branch, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard\/$/);
}

/**
 * The kitchen has the order ready, as staff mark it on the Kitchen board (a member of staff is
 * signed in at its branch). Against the backend that's the only way it moves; the mock's kitchen
 * moves by itself on its timing, so tests call this only `againstBackend`.
 */
export async function markReadyInKitchen(page: Page, orderId: string) {
  await page.goto('/admin/kitchen-dashboard/');
  const ready = page
    .getByRole('button', { name: new RegExp(`^Mark order #?${orderId} ready`) })
    .filter({ visible: true })
    .first();
  await ready.click();
  await expect(
    page
      .getByRole('button', { name: new RegExp(`^Mark order #?${orderId} ready`) })
      .filter({ visible: true }),
  ).toHaveCount(0);
}

/**
 * The staff pages are open on this branch: its short name in the shell (the sidebar from
 * 1024px, the app bar below).
 */
export async function expectBranchOpen(page: Page, shortName: string) {
  await expect(page).toHaveURL(/\/admin\/dashboard\/$/);
  await expect(
    page.getByText(shortName, { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
}
