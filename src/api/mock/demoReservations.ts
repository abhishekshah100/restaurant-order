import { createClock } from '@/lib/clock';
import type { Reservation, ReservationStatus } from '@/types/admin';
import type { Branch } from '@/types/branch';

/*
 * MOCK ONLY — sample bookings, so the Reservations page and the floor plan's reserved tables
 * aren't empty: two parties due within the hour (one late), guests already seated, bookings
 * later today and on the next days, a cancellation and a no-show. Written into the branch's
 * bookings the first time they're read under `npm run dev` (never in a build or tests; off with
 * NEXT_PUBLIC_ADMIN_DEMO=false, like the demo floor), then they're ordinary bookings staff can
 * seat, change or cancel. Tables are ones the demo floor leaves free.
 */

interface DemoReservation {
  table: number;
  guestName: string;
  phone?: string;
  partySize: number;
  /** Minutes from now, or [days from today, local "HH:MM"]. */
  when: number | [number, string];
  minutes?: number;
  note?: string;
  status?: ReservationStatus;
}

const DEMO_RESERVATIONS: DemoReservation[] = [
  {
    table: 6,
    guestName: 'Rahul Mehta',
    phone: '9876501234',
    partySize: 4,
    when: 35,
    note: 'Anniversary dinner. A quiet corner, please.',
  },
  { table: 1, guestName: 'Vikram Rao', phone: '9812345670', partySize: 2, when: -12 },
  {
    table: 12,
    guestName: 'Sneha Kapoor',
    phone: '9845012345',
    partySize: 5,
    when: 150,
    minutes: 120,
    note: 'Birthday. They bring their own cake.',
  },
  {
    table: 13,
    guestName: 'Karan Malhotra',
    partySize: 2,
    when: -40,
    status: 'seated',
  },
  {
    table: 8,
    guestName: 'Office team lunch',
    phone: '9811122233',
    partySize: 8,
    when: 240,
    minutes: 120,
    note: 'One bill for the whole table.',
  },
  {
    table: 15,
    guestName: 'Ananya Iyer',
    partySize: 2,
    when: 300,
    note: 'Outdoor, if the weather holds.',
  },
  {
    table: 14,
    guestName: 'Meera Shah',
    phone: '9800012345',
    partySize: 3,
    when: -95,
    status: 'noShow',
  },
  { table: 10, guestName: 'Dev Patel', partySize: 4, when: 180, status: 'cancelled' },
  {
    table: 5,
    guestName: 'The Sharma family',
    phone: '9876598765',
    partySize: 6,
    when: [1, '13:00'],
    note: 'High chair for a toddler.',
  },
  { table: 2, guestName: 'Isha Verma', phone: '9822233344', partySize: 3, when: [1, '20:00'] },
  { table: 16, guestName: 'Nikhil Joshi', partySize: 4, when: [2, '19:30'], minutes: 120 },
];

const MINUTE = 60_000;

/** The sample bookings at a branch, timed from `now` (seated and closed ones as if done then). */
export function demoReservations(branch: Branch, now: number): Reservation[] {
  const clock = createClock(branch);
  const iso = (at: number) => new Date(at).toISOString();
  // Round "in 35 min" to the 5 minutes, as a booking would be.
  const rounded = (at: number) => Math.round(at / (5 * MINUTE)) * 5 * MINUTE;
  return DEMO_RESERVATIONS.map((demo, i) => {
    const at =
      typeof demo.when === 'number'
        ? iso(rounded(now + demo.when * MINUTE))
        : new Date(clock.localTimestamp(-demo.when[0], demo.when[1], new Date(now))).toISOString();
    const status = demo.status ?? 'booked';
    const done =
      status === 'booked' ? {} : { updatedAt: iso(now - 5 * MINUTE), updatedBy: 'Abhishek' };
    return {
      id: `R${1001 + i}`,
      table: demo.table,
      tables: [demo.table],
      guestName: demo.guestName,
      ...(demo.phone ? { phone: demo.phone } : {}),
      partySize: demo.partySize,
      at,
      minutes: demo.minutes ?? 90,
      ...(demo.note ? { note: demo.note } : {}),
      status,
      createdAt: iso(now - 2 * 24 * 60 * MINUTE),
      createdBy: 'Abhishek',
      ...(status === 'seated' ? { seatedAt: iso(Date.parse(at) + 5 * MINUTE) } : {}),
      ...done,
    };
  });
}
