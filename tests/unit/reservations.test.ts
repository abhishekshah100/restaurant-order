import { describe, expect, it } from 'vitest';
import { reservationsPath } from '@/lib/adminNav';
import { createClock } from '@/lib/clock';
import {
  bookingDays,
  canMarkNoShow,
  canSeat,
  clashWith,
  dayOffset,
  dayParts,
  filterReservations,
  guestCount,
  isDue,
  reservationCounts,
  reservationErrors,
  reservationForm,
  reservationInput,
  reservationState,
  tableChoices,
  timeSlots,
} from '@/lib/reservations';
import type { AdminFloor, Reservation } from '@/types/admin';
import type { Branch } from '@/types/branch';
import { testBranches } from '../apiState';

/*
 * Reservations' shared rules: when a booking holds its table, is due, late, can be seated or
 * marked a no-show; the Reservations page's filters, counts, days and times; the booking form's
 * checks and request; the table picker's clashes and best fit.
 */

const branch = testBranches().find((b) => b.id === 'blr-indiranagar') as Branch;
const clock = createClock(branch);
const MIN = 60_000;
const NOW = Date.parse('2026-10-15T13:00:00Z'); // 6:30 PM in Bengaluru

const reservation = (fields: Partial<Reservation> = {}): Reservation => ({
  id: 'R1001',
  table: 6,
  guestName: 'Rahul Mehta',
  phone: '9876501234',
  partySize: 4,
  at: '2026-10-15T13:30:00.000Z', // 7:00 PM
  minutes: 90,
  status: 'booked',
  createdAt: '2026-10-14T10:00:00.000Z',
  createdBy: 'Abhishek',
  ...fields,
});

describe('reservation rules', () => {
  it('finds the booking holding a table then (booked or seated, overlapping)', () => {
    const list = [
      reservation(),
      reservation({ id: 'R1002', table: 7, status: 'cancelled' }),
      reservation({ id: 'R1003', table: 8, status: 'seated' }),
    ];
    const at = (iso: string, table = 6) => clashWith(list, { table, at: iso, minutes: 60 })?.id;
    expect(at('2026-10-15T14:30:00.000Z')).toBe('R1001'); // 8:00, inside 7:00–8:30
    expect(at('2026-10-15T12:45:00.000Z')).toBe('R1001'); // 6:15–7:15 runs into it
    expect(at('2026-10-15T15:00:00.000Z')).toBeUndefined(); // 8:30, back to back
    expect(at('2026-10-15T12:30:00.000Z')).toBeUndefined(); // 6:00–7:00, ends as it starts
    expect(at('2026-10-15T13:30:00.000Z', 7)).toBeUndefined(); // cancelled
    expect(at('2026-10-15T13:30:00.000Z', 8)).toBe('R1003'); // seated
    // The booking itself, being changed, doesn't clash with itself.
    expect(clashWith(list, reservation(), 'R1001')).toBeUndefined();
  });

  it('is due from an hour before until half an hour after; seated from an hour before', () => {
    const r = reservation();
    const at = Date.parse(r.at);
    expect(isDue(r, at - 61 * MIN)).toBe(false);
    expect(isDue(r, at - 60 * MIN)).toBe(true);
    expect(isDue(r, at + 30 * MIN)).toBe(true);
    expect(isDue(r, at + 31 * MIN)).toBe(false);
    expect(isDue(reservation({ status: 'seated' }), at)).toBe(false);
    expect(canSeat(r, at - 61 * MIN)).toBe(false);
    expect(canSeat(r, at - 60 * MIN)).toBe(true);
    expect(canSeat(r, at + 120 * MIN)).toBe(true);
    expect(canMarkNoShow(r, at - MIN)).toBe(false);
    expect(canMarkNoShow(r, at)).toBe(true);
  });

  it('reads as upcoming, arriving soon, late, then its status', () => {
    const r = reservation();
    const at = Date.parse(r.at);
    expect(reservationState(r, at - 90 * MIN)).toBe('upcoming');
    expect(reservationState(r, at - 30 * MIN)).toBe('arriving');
    expect(reservationState(r, at + 30 * 1000)).toBe('arriving');
    expect(reservationState(r, at + 12 * MIN)).toBe('late');
    expect(reservationState(reservation({ status: 'noShow' }), at)).toBe('noShow');
  });
});

describe('the Reservations page', () => {
  const day = [
    reservation(),
    reservation({
      id: 'R1002',
      table: 2,
      guestName: 'Isha Verma',
      phone: undefined,
      at: '2026-10-15T12:30:00.000Z',
      partySize: 2,
      status: 'seated',
    }),
    reservation({ id: 'R1003', table: 12, guestName: 'Dev Patel', status: 'cancelled' }),
    reservation({
      id: 'R1004',
      table: 14,
      guestName: 'Meera Shah',
      status: 'noShow',
      partySize: 3,
    }),
  ];

  it('counts each filter and the guests expected (booked and seated)', () => {
    expect(reservationCounts(day)).toEqual({ upcoming: 1, seated: 1, closed: 2, all: 4 });
    expect(guestCount(day)).toBe(6);
  });

  it('filters and searches by name, mobile, booking or table, by time', () => {
    expect(filterReservations(day, 'all', '').map((r) => r.id)).toEqual([
      'R1002',
      'R1001',
      'R1003',
      'R1004',
    ]);
    expect(filterReservations(day, 'closed', '').map((r) => r.id)).toEqual(['R1003', 'R1004']);
    expect(filterReservations(day, 'all', 'isha').map((r) => r.id)).toEqual(['R1002']);
    expect(filterReservations(day, 'all', '98765 01').map((r) => r.guestName)).toContain(
      'Rahul Mehta',
    );
    expect(filterReservations(day, 'all', 'r1003').map((r) => r.id)).toEqual(['R1003']);
    expect(filterReservations(day, 'all', '12').map((r) => r.id)).toEqual(['R1003']);
  });

  it('offers two weeks of days in the branch calendar, and the day in the address', () => {
    const late = new Date('2026-10-15T19:00:00Z'); // 12:30 AM on the 16th in Bengaluru
    const days = bookingDays(clock, late);
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ key: '2026-10-16', offset: 0 });
    expect(days[13].key).toBe('2026-10-29');
    expect(dayOffset(clock, late, '2026-10-18')).toBe(2);
    expect(dayParts('2026-10-17')).toEqual({ weekday: 'Sat', day: '17', month: 'Oct' });
    expect(reservationsPath()).toBe('/admin/dashboard/reservations/');
    expect(reservationsPath('2026-10-17')).toBe('/admin/dashboard/reservations/?day=2026-10-17');
  });

  it('offers times every 15 minutes while open, until an hour before closing; today from now', () => {
    const tomorrow = timeSlots(branch, 1, new Date(NOW));
    expect(clock.time(tomorrow[0])).toBe(branch.opensAt);
    expect(tomorrow.every((s) => clock.dayKey(s) === '2026-10-16')).toBe(true);
    expect(Date.parse(tomorrow[1]) - Date.parse(tomorrow[0])).toBe(15 * MIN);
    const today = timeSlots(branch, 0, new Date(NOW));
    expect(clock.time(today[0])).toBe('6:30 PM');
    const closes = Date.parse(clock.localTimestamp(0, branch.hours.closes, new Date(NOW)));
    expect(Date.parse(today.at(-1) ?? '')).toBe(closes - 60 * MIN);
  });
});

describe('the booking form and table picker', () => {
  it('opens on today with two guests (and the table given), or on the booking', () => {
    expect(reservationForm(clock, new Date(NOW), undefined, 5)).toMatchObject({
      day: '2026-10-15',
      partySize: 2,
      at: '',
      minutes: 90,
      table: 5,
    });
    expect(reservationForm(clock, new Date(NOW), reservation({ note: 'Cake' }))).toMatchObject({
      guestName: 'Rahul Mehta',
      day: '2026-10-15',
      table: 6,
      note: 'Cake',
    });
  });

  it('checks the name, mobile, time and table, and builds the request', () => {
    const empty = reservationForm(clock, new Date(NOW));
    expect(reservationErrors({ ...empty, phone: '12345' }, branch.mobile)).toEqual({
      guestName: 'name',
      phone: 'phoneLength',
      at: 'time',
      table: 'table',
    });
    const filled = {
      ...empty,
      guestName: '  Rahul  ',
      at: '2026-10-15T19:00:00+05:30',
      table: 6,
      note: '  ',
    };
    expect(reservationErrors(filled, branch.mobile)).toEqual({});
    expect(reservationInput(filled)).toEqual({
      table: 6,
      guestName: 'Rahul',
      partySize: 2,
      at: '2026-10-15T19:00:00+05:30',
      minutes: 90,
    });
  });

  it('marks tables booked then, too small, and the smallest free one that fits', () => {
    const floors = [
      {
        id: 'ground',
        name: 'Ground floor',
        tables: [
          { table: 1, seats: 2 },
          { table: 6, seats: 4 },
          { table: 7, seats: 4 },
          { table: 8, seats: 8 },
        ],
      },
    ] as Pick<AdminFloor, 'id' | 'name' | 'tables'>[];
    // The form passes itself, with the table picked so far.
    const form = { at: '2026-10-15T14:00:00.000Z', minutes: 90, partySize: 3, table: null };
    const [ground] = tableChoices(floors, [reservation()], form);
    expect(
      ground.tables.map(({ table, clash, tooSmall, bestFit }) => ({
        table,
        clash: clash?.id,
        tooSmall,
        bestFit,
      })),
    ).toEqual([
      { table: 1, clash: undefined, tooSmall: true, bestFit: false },
      { table: 6, clash: 'R1001', tooSmall: false, bestFit: false },
      { table: 7, clash: undefined, tooSmall: false, bestFit: true },
      { table: 8, clash: undefined, tooSmall: false, bestFit: false },
    ]);
    // Changing R1001, its own table is free.
    const [own] = tableChoices(
      floors,
      [reservation()],
      { ...reservation(), partySize: 4 },
      'R1001',
    );
    expect(own.tables.find((c) => c.table === 6)).toMatchObject({ bestFit: true });
  });
});
