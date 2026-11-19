import {
  expect,
  test,
  addDish,
  adminSignIn,
  againstBackend,
  orderAtCounter,
  scan,
} from './helpers';

/**
 * Sales, the manager's report (the server's only: it adds up real orders). A guest orders at
 * table 5; the manager opens Sales, sees today's numbers, the dish among the best sellers and
 * the money summary, moves between the presets, picks their own days, and opens one day from
 * the chart. The server keeps orders between tests, so the
 * figures are checked for being there, not for exact amounts (the server's tests do that).
 */

test.describe('against the server', () => {
  test.skip(!againstBackend, 'The sales report needs the server.');

  test("today's sales, the presets, picked days and one day from the chart", async ({ page }) => {
    test.slow();
    await scan(page, 'table=5');
    await addDish(page, 'starters', 'Dahi Kebab');
    // A number of this run's own (the server limits the codes one number gets).
    await orderAtCounter(page, `98${String(Date.now()).slice(-8)}`);

    await adminSignIn(page);
    await page.goto('/admin/dashboard/sales/');
    await expect(page.getByRole('heading', { name: 'Sales', level: 1 })).toBeVisible();
    const presets = page.getByRole('group', { name: 'Show sales for' });
    await expect(presets.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // What "Compared with" means, a tap away.
    await page.getByRole('button', { name: 'What does Compared with mean?' }).click();
    const about = page.getByRole('note').filter({ hasText: 'is the days this report is about' });
    await expect(about).toContainText('the 7 days just before');
    await about.getByRole('button', { name: 'Got it' }).click();
    await expect(about).toHaveCount(0);

    // Today: the order is in the headline numbers, the chart and the split by order type.
    await presets.getByRole('button', { name: 'Today' }).click();
    await expect(page).toHaveURL(/\?from=(\d{4}-\d{2}-\d{2})&to=\1$/);
    const headline = page.getByRole('region', { name: 'Headline numbers' });
    const orders = headline.getByRole('article').filter({ hasText: 'Orders' });
    await expect(orders.locator('p').first()).toHaveText(/^[1-9]\d*$/);
    await expect(headline.getByRole('article').filter({ hasText: 'Net sales' })).toContainText(
      /₹[\d,]+/,
    );
    await expect(page.getByRole('heading', { name: 'Sales by day' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'By order type' })).toContainText('Dine-in');

    // The dish in Best sellers (by sales, then by how many), its category, the money summary.
    const best = page.getByRole('region', { name: 'Best sellers' });
    await expect(best.getByRole('listitem').filter({ hasText: 'Dahi Kebab' })).toContainText(
      /₹[\d,]+/,
    );
    await best.getByRole('button', { name: 'Quantity' }).click();
    await expect(best.getByRole('button', { name: 'Quantity' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(best.getByRole('listitem').filter({ hasText: 'Dahi Kebab' })).toContainText(
      /\d+ sold/,
    );
    await expect(page.getByRole('region', { name: 'Categories' })).toContainText('Starters');
    const money = page.getByRole('region', { name: 'Money summary' });
    for (const line of ['Net sales', 'Total billed', 'Net received']) {
      await expect(money.getByRole('rowheader', { name: line })).toBeVisible();
    }

    // Days of their own.
    await presets.getByRole('button', { name: 'Pick dates' }).click();
    await expect(page.getByRole('textbox', { name: 'From', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'To', exact: true })).toBeVisible();

    // Last 7 days, then today's column opens today on its own.
    await presets.getByRole('button', { name: 'Last 7 days' }).click();
    await expect(page).toHaveURL(/\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
    const days = page
      .getByRole('region', { name: 'Sales by day' })
      .getByRole('button', { name: /Opens that day on its own/ });
    await expect(days).toHaveCount(7);
    await days.last().click();
    await expect(page).toHaveURL(/\?from=(\d{4}-\d{2}-\d{2})&to=\1$/);
    await expect(presets.getByRole('button', { name: 'Today' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('exports the report, prints it, and sets the branches side by side', async ({ page }) => {
    // The browser's print dialog would block the test: printing only builds the print sheet.
    await page.addInitScript(() => {
      window.print = () => undefined;
    });
    await adminSignIn(page);
    await page.goto('/admin/dashboard/sales/');
    await expect(page.getByRole('heading', { name: 'Sales by day' })).toBeVisible();

    // Excel: one workbook, named after the branch and the days.
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download this report as an Excel file' }).click();
    expect((await download).suggestedFilename()).toMatch(
      /^sales-blr-indiranagar-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );

    // PDF: the report on A4 pages, one tap.
    const pdf = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download this report as a PDF' }).click();
    expect((await pdf).suggestedFilename()).toMatch(
      /^sales-blr-indiranagar-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.pdf$/,
    );

    // The sales register for the same days, from the money summary.
    const register = page.waitForEvent('download');
    await page
      .getByRole('region', { name: 'Money summary' })
      .getByRole('button', { name: /^Download the sales register/ })
      .click();
    expect((await register).suggestedFilename()).toMatch(
      /^sales-register-blr-indiranagar-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/,
    );

    // Print: the report on its own sheet, titled.
    await page.getByRole('button', { name: 'Print this report' }).click();
    const sheet = page.locator('[data-print-sheet]');
    await expect(sheet).toContainText('Sales report');
    await expect(sheet).toContainText('Net sales');

    // Every branch side by side, this one marked; another opens its own report.
    await page
      .getByRole('group', { name: 'Show', exact: true })
      .getByRole('button', { name: 'All branches' })
      .click();
    await expect(page).toHaveURL(/view=branches/);
    const branches = page.getByRole('region', { name: 'Branches compared' });
    await expect(branches.getByRole('listitem').filter({ hasText: 'This branch' })).toHaveCount(1);
    await expect(branches.getByRole('listitem')).toHaveCount(2);
    await branches.getByRole('button', { name: /^Open the sales report of / }).click();
    await expect(page).not.toHaveURL(/view=branches/);
    await expect(page.getByRole('heading', { name: 'Sales by day' })).toBeVisible();
  });

  test('managers find Sales in the menu', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'The sidebar is the desktop menu.');
    await adminSignIn(page);
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Sales' })
      .click();
    await expect(page).toHaveURL(/\/admin\/dashboard\/sales\/$/);
    await expect(page.getByRole('heading', { name: 'Sales', level: 1 })).toBeVisible();
  });
});

test('on the mock alone, the page says it needs the server', async ({ page }) => {
  test.skip(againstBackend, 'The mock has no sales report.');
  await adminSignIn(page);
  await page.goto('/admin/dashboard/sales/');
  await expect(page.getByRole('heading', { name: 'Sales reports need the server' })).toBeVisible();
});
