import { describe, expect, it } from 'vitest';
import { reservationsPath } from '@/lib/adminNav';
import { createClock } from '@/lib/clock';
import {
  addDays,
  addMonths,
  bookingDays,
  bookingRange,
  byDay,
  filterHistory,
  historyCounts,
  historySummary,
  isUnmarked,
  canMarkNoShow,
  canSeat,
  clashWith,
  dayOffset,
  dayParts,
  monthName,
  monthWeeks,
  filterReservations,
  guestCount,
  isDue,
  reservationCounts,
  reservationErrors,
  reservationForm,
  reservationInput,
  reservationState,
  suggestTables,
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
    const at = (iso: string, table = 6) =>
      clashWith(list, { tables: [table], at: iso, minutes: 60 })?.id;
    expect(at('2026-10-15T14:30:00.000Z')).toBe('R1001'); // 8:00, inside 7:00–8:30
    expect(at('2026-10-15T12:45:00.000Z')).toBe('R1001'); // 6:15–7:15 runs into it
    expect(at('2026-10-15T15:00:00.000Z')).toBeUndefined(); // 8:30, back to back
    expect(at('2026-10-15T12:30:00.000Z')).toBeUndefined(); // 6:00–7:00, ends as it starts
    expect(at('2026-10-15T13:30:00.000Z', 7)).toBeUndefined(); // cancelled
    expect(at('2026-10-15T13:30:00.000Z', 8)).toBe('R1003'); // seated
    // The booking itself, being changed, doesn't clash with itself.
    expect(clashWith(list, { ...reservation(), tables: [6] }, 'R1001')).toBeUndefined();
    // A party on tables 6 and 9 clashes on either; asking for 9 finds it.
    const party = [reservation({ id: 'R1004', table: 6, tables: [6, 9] })];
    expect(clashWith(party, { tables: [9], at: reservation().at, minutes: 60 })?.id).toBe('R1004');
    expect(clashWith(party, { tables: [5, 7], at: reservation().at, minutes: 60 })).toBeUndefined();
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

  it('offers today and tomorrow in the branch calendar, a calendar to 60 days ahead, and the day in the address', () => {
    const late = new Date('2026-10-15T19:00:00Z'); // 12:30 AM on the 16th in Bengaluru
    const days = bookingDays(clock, late);
    expect(days).toEqual([
      { key: '2026-10-16', offset: 0 },
      { key: '2026-10-17', offset: 1 },
    ]);
    expect(bookingRange(clock, late)).toEqual({ min: '2026-10-16', max: '2026-12-15' });
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthName('2026-10')).toBe('October 2026');
    // October 2026 starts on a Thursday and has 31 days: five weeks, Sunday first.
    const weeks = monthWeeks('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(weeks[4]).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ]);
    expect(monthWeeks('2027-02').flat().filter(Boolean)).toHaveLength(28);
    expect(dayOffset(clock, late, '2026-10-18')).toBe(2);
    expect(dayParts('2026-10-17')).toEqual({ weekday: 'Sat', day: '17', month: 'Oct' });
    expect(reservationsPath()).toBe('/admin/dashboard/reservations/');
    expect(reservationsPath('2026-10-17')).toBe('/admin/dashboard/reservations/?day=2026-10-17');
  });

  it('offers times every 15 minutes while open, until an hour before closing; today from now', () => {
    // Friday's hours (the day booked), from the week.
    const [friday] = branch.schedule.days.fri;
    const tomorrow = timeSlots(branch, 1, new Date(NOW));
    expect(clock.time(tomorrow[0])).toBe(
      clock.time(clock.localTimestamp(-1, friday.opens, new Date(NOW))),
    );
    expect(tomorrow.every((s) => clock.dayKey(s) === '2026-10-16')).toBe(true);
    expect(Date.parse(tomorrow[1]) - Date.parse(tomorrow[0])).toBe(15 * MIN);
    const today = timeSlots(branch, 0, new Date(NOW));
    expect(clock.time(today[0])).toBe('6:30 PM');
    const closes = Date.parse(
      clock.localTimestamp(0, branch.schedule.days.thu[0].closes, new Date(NOW)),
    );
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
      tables: [5],
    });
    expect(reservationForm(clock, new Date(NOW), reservation({ note: 'Cake' }))).toMatchObject({
      guestName: 'Rahul Mehta',
      day: '2026-10-15',
      tables: [6],
      note: 'Cake',
    });
  });

  it('checks the name, mobile, time and table, and builds the request', () => {
    const empty = reservationForm(clock, new Date(NOW));
    expect(reservationErrors({ ...empty, phone: '12345' }, branch.mobile, 0)).toEqual({
      guestName: 'name',
      phone: 'phoneLength',
      at: 'time',
      table: 'table',
    });
    const filled = {
      ...empty,
      guestName: '  Rahul  ',
      at: '2026-10-15T19:00:00+05:30',
      tables: [6, 7],
      note: '  ',
    };
    expect(reservationErrors(filled, branch.mobile, 8)).toEqual({});
    // Eight guests on tables seating six between them: held back.
    expect(reservationErrors({ ...filled, partySize: 8 }, branch.mobile, 6)).toEqual({
      table: 'seats',
    });
    expect(reservationInput(filled)).toEqual({
      table: 6,
      tables: [6, 7],
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
    const form = { at: '2026-10-15T14:00:00.000Z', minutes: 90, partySize: 3, tables: [] };
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

  it('suggests the fewest free tables in one area for a party no table seats alone', () => {
    const floors = [
      {
        id: 'ground',
        name: 'Ground floor',
        tables: [
          { table: 1, seats: 2 },
          { table: 2, seats: 3 },
          { table: 4, seats: 4 },
          { table: 5, seats: 4 },
          { table: 6, seats: 4 },
        ],
      },
      {
        id: 'patio',
        name: 'Patio',
        tables: [{ table: 20, seats: 6 }],
      },
    ] as Pick<AdminFloor, 'id' | 'name' | 'tables'>[];
    const slot = (partySize: number) => ({
      at: '2026-10-15T14:00:00.000Z',
      minutes: 90,
      partySize,
    });
    const suggest = (partySize: number, reservations: Reservation[] = []) =>
      suggestTables(tableChoices(floors, reservations, slot(partySize)), partySize);
    // One table seats them: the smallest.
    expect(suggest(3)).toEqual([2]);
    // Eight: two tables of 4, side by side; never across areas.
    expect(suggest(8)).toEqual([4, 5]);
    // Table 5 booked then: the next two of 4.
    expect(suggest(8, [reservation({ table: 5, tables: [5] })])).toEqual([4, 6]);
    // Nine: three tables, the fewest seats to spare (2 + 3 + 4).
    expect(suggest(9)).toEqual([1, 2, 4]);
    // More than any area seats: nothing to suggest.
    expect(suggest(20)).toEqual([]);
    // Each table suggested is marked Best fit.
    const [ground] = tableChoices(floors, [], slot(8));
    expect(ground.tables.filter((c) => c.bestFit).map((c) => c.table)).toEqual([4, 5]);
  });

  it("doesn't suggest a table with guests at it now (paid and still seated too) for a booking soon", () => {
    const floors = [
      {
        id: 'ground',
        name: 'Ground floor',
        tables: [
          { table: 6, seats: 4, status: 'paidSeated' },
          { table: 7, seats: 4, status: 'available' },
        ],
      },
    ] as Pick<AdminFloor, 'id' | 'name' | 'tables'>[];
    const slot = { at: '2026-10-15T14:00:00.000Z', minutes: 90, partySize: 4 };
    // 30 minutes before: table 6's guests are still there, so 7 is the suggestion.
    const [soon] = tableChoices(floors, [], slot, undefined, new Date('2026-10-15T13:30:00Z'));
    expect(soon.tables.map(({ table, inUse, bestFit }) => ({ table, inUse, bestFit }))).toEqual([
      { table: 6, inUse: true, bestFit: false },
      { table: 7, inUse: false, bestFit: true },
    ]);
    // Tonight, hours away: who sits there now doesn't matter; the smallest fit wins again.
    const [later] = tableChoices(floors, [], slot, undefined, new Date('2026-10-15T09:00:00Z'));
    expect(later.tables.find((c) => c.table === 6)).toMatchObject({ inUse: false, bestFit: true });
  });
});

describe('the history', () => {
  const LATER = Date.parse('2026-10-17T06:00:00Z'); // two days on
  const list = [
    reservation({ id: 'R1001', status: 'seated' }),
    reservation({ id: 'R1002', status: 'noShow', partySize: 2 }),
    reservation({ id: 'R1003', status: 'cancelled', guestName: 'Priya' }),
    // Never marked: still booked, its hold long over.
    reservation({ id: 'R1004', guestName: 'Kabir', at: '2026-10-16T14:00:00.000Z' }),
    // Still to come today: not "not marked".
    reservation({ id: 'R1005', at: '2026-10-17T13:30:00.000Z' }),
  ];

  it('marks a booking "not marked" only once its hold is over', () => {
    const r = reservation(); // 7:00 PM for 90 minutes
    expect(isUnmarked(r, Date.parse('2026-10-15T14:59:00Z'))).toBe(false);
    expect(isUnmarked(r, Date.parse('2026-10-15T15:00:00Z'))).toBe(true);
    expect(isUnmarked(reservation({ status: 'seated' }), LATER)).toBe(false);
  });

  it('counts and filters: came, no-shows, cancelled, not marked; the latest first', () => {
    expect(historyCounts(list, LATER)).toEqual({
      all: 5,
      seated: 1,
      noShow: 1,
      cancelled: 1,
      unmarked: 1,
    });
    expect(filterHistory(list, 'all', '', LATER).map((r) => r.id)).toEqual([
      'R1005',
      'R1004',
      'R1003',
      'R1002',
      'R1001',
    ]);
    expect(filterHistory(list, 'unmarked', '', LATER).map((r) => r.id)).toEqual(['R1004']);
    expect(filterHistory(list, 'all', 'priya', LATER).map((r) => r.id)).toEqual(['R1003']);
  });

  it('sums up the days: guests who came and the share that showed up', () => {
    // Due: the one that came, the no-show and the one never marked; 1 of 3 came.
    expect(historySummary(list, LATER)).toEqual({
      bookings: 5,
      guests: 4,
      noShows: 1,
      cancelled: 1,
      showRate: 33,
    });
    expect(historySummary([], LATER).showRate).toBeNull();
  });

  it('puts the bookings under their day, in the order given', () => {
    const days = byDay(filterHistory(list, 'all', '', LATER), clock);
    expect(days.map((d) => [d.day, d.reservations.length])).toEqual([
      ['2026-10-17', 1],
      ['2026-10-16', 1],
      ['2026-10-15', 3],
    ]);
  });
});
