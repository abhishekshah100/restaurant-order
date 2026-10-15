import { expect, test } from '@playwright/test';
import { adminSignIn } from './helpers';

/**
 * Reservations: a table booked for tonight from the Reservations page (the form's checks, the
 * best fit, a table booked then can't be picked twice), the table reserved on the floor plan,
 * the guests seated from the table's page, and a booking for tomorrow cancelled.
 */

test('book a table, see it reserved, seat the guests and cancel another booking', async ({
  page,
}) => {
  test.slow();
  // 6:15 PM in Bengaluru, so 7:00 PM is within the hour.
  await page.clock.install({ time: new Date('2026-10-15T12:45:00Z') });
  await adminSignIn(page);
  await page.goto('/admin/dashboard/reservations/');
  await expect(page.getByText('No bookings')).toBeVisible();

  await page.getByRole('button', { name: 'New reservation' }).click();
  let form = page.getByRole('dialog', { name: 'New reservation' });
  await form.getByRole('button', { name: 'Book table' }).click();
  await expect(form.getByText("Enter the guest's name")).toBeVisible();
  await expect(form.getByText('Pick a time', { exact: true }).last()).toBeVisible();

  await form.getByLabel('Name').fill('Rahul Mehta');
  await form.getByLabel('Mobile').fill('9876501234');
  await form.getByRole('button', { name: 'Add one guest' }).click();
  await form.getByRole('button', { name: 'Add one guest' }).click();
  await expect(form.getByText('4 guests')).toBeVisible();
  await form.getByLabel('Time').selectOption({ label: '7:00 PM' });
  // The smallest free table for four is suggested.
  await expect(form.getByRole('button', { name: /^Table 2, 4 seats, Best fit$/ })).toBeVisible();
  await form.getByRole('button', { name: /^Table 6, 4 seats/ }).click();
  await form.getByLabel('Note').fill('Anniversary');
  await form.getByRole('button', { name: 'Book table' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Table 6 booked for Rahul Mehta at 7:00 PM' }),
  ).toBeVisible();
  const row = page.getByRole('button', {
    name: /^Booking R1001: Rahul Mehta, 7:00 PM, Arriving soon/,
  });
  await expect(row).toBeVisible();

  // Table 6 can't be booked again then.
  await page.getByRole('button', { name: 'New reservation' }).click();
  form = page.getByRole('dialog', { name: 'New reservation' });
  await form.getByLabel('Time').selectOption({ label: '7:30 PM' });
  await expect(
    form.getByRole('button', { name: /^Table 6, 4 seats, Booked 7:00 PM/ }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.goto('/admin/dashboard/tables/');
  await expect(page.getByRole('link', { name: 'Table 6, 4 seats: Reserved' })).toBeVisible();
  await page.getByRole('link', { name: 'Table 6, 4 seats: Reserved' }).click();
  await expect(page.getByRole('heading', { name: 'Bookings today' })).toBeVisible();
  await page.getByRole('button', { name: 'Seat Rahul Mehta at table 6' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Rahul Mehta seated at table 6' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Table 6' })).toContainText('Seated');

  // A booking for tomorrow, from the table's page, then cancelled.
  await page.getByRole('button', { name: 'Reserve' }).click();
  form = page.getByRole('dialog', { name: 'New reservation' });
  await form.getByLabel('Name').fill('Isha Verma');
  await form.getByRole('button', { name: /^Tomorrow/ }).click();
  await form.getByLabel('Time').selectOption({ label: '8:00 PM' });
  await expect(form.getByRole('button', { name: /^Table 6, 4 seats/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await form.getByRole('button', { name: 'Book table' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Table 6 booked for Isha Verma at 8:00 PM' }),
  ).toBeVisible();

  await page.goto('/admin/dashboard/reservations/?day=2026-10-16');
  await page.getByRole('button', { name: /^Booking R1002: Isha Verma/ }).click();
  const booking = page.getByRole('dialog', { name: 'Booking R1002' });
  await expect(booking.getByRole('button', { name: 'Seat guests' })).toBeDisabled();
  await booking.getByRole('button', { name: 'Cancel booking' }).click();
  await page
    .getByRole('dialog', { name: 'Cancel booking R1002?' })
    .getByRole('button', { name: 'Cancel booking' })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Booking R1002 cancelled' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Cancelled & no-show/ }).click();
  await expect(
    page.getByRole('button', { name: /^Booking R1002: Isha Verma, 8:00 PM, Cancelled/ }),
  ).toBeVisible();
});
