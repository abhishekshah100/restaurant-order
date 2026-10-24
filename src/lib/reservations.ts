import type { ReservationInput } from '@/api/contracts';
import type { AdminFloor, Reservation, ReservationStatus } from '@/types/admin';
import type { Branch, MobileRules } from '@/types/branch';
import { sessionMinutes, sessionsOn, weekdayAt } from './branchHours';
import { createClock, type Clock } from './clock';
import { mobileError, type PhoneError } from './phone';

/*
 * Reservations, pure: the rules the server and the staff pages share (when a booking holds its
 * table, when it's due, late, can be seated), the Reservations page's filters, days and times,
 * the booking form and the table picker.
 */

/** A booked table shows as reserved from this long before its time… */
export const HOLD_BEFORE_MINUTES = 60;
/** …until this long after it (the party is late; after that the table is free to use). */
export const HOLD_AFTER_MINUTES = 30;
/** How long a booking can hold its table, in minutes. */
export const DURATIONS = [60, 90, 120, 150, 180] as const;
export const DEFAULT_MINUTES = 90;
export const MAX_PARTY = 20;
export const MAX_NOTE = 200;
export const MAX_NAME = 60;
/** The days the Reservations page and the booking form show as tiles, today first; a calendar has the rest. */
export const BOOKING_DAYS = 2;
/** The furthest ahead the server takes a booking. */
export const MAX_DAYS_AHEAD = 60;
/** Booking times go up in these steps. */
export const SLOT_MINUTES = 15;

const MINUTE = 60_000;
const DAY = 86_400_000;

const startOf = (r: Pick<Reservation, 'at'>) => Date.parse(r.at);
const endOf = (r: Pick<Reservation, 'at' | 'minutes'>) => startOf(r) + r.minutes * MINUTE;

/** Booked or seated: the table is the party's for its minutes. */
export const holdsTable = (r: Pick<Reservation, 'status'>) =>
  r.status === 'booked' || r.status === 'seated';

/**
 * The booking (other than `ignoreId`) holding `table` for any part of `minutes` from `at`:
 * the clash that stops a new or changed booking. Undefined when the table is free then.
 */
export function clashWith(
  reservations: readonly Reservation[],
  slot: Pick<Reservation, 'table' | 'at' | 'minutes'>,
  ignoreId?: string,
): Reservation | undefined {
  const start = startOf(slot);
  const end = endOf(slot);
  return reservations.find(
    (r) =>
      r.id !== ignoreId &&
      r.table === slot.table &&
      holdsTable(r) &&
      startOf(r) < end &&
      start < endOf(r),
  );
}

/** Booked and due: from an hour before its time until half an hour after (the table is held). */
export function isDue(r: Reservation, now: number): boolean {
  const start = startOf(r);
  return (
    r.status === 'booked' &&
    now >= start - HOLD_BEFORE_MINUTES * MINUTE &&
    now <= start + HOLD_AFTER_MINUTES * MINUTE
  );
}

/** The guests can be seated: booked, from an hour before its time. */
export const canSeat = (r: Reservation, now: number) =>
  r.status === 'booked' && now >= startOf(r) - HOLD_BEFORE_MINUTES * MINUTE;

/** The guests didn't come: booked, once its time has passed. */
export const canMarkNoShow = (r: Reservation, now: number) =>
  r.status === 'booked' && now >= startOf(r);

/** Minutes a booked party is past its time; 0 when it isn't. */
export const lateBy = (r: Pick<Reservation, 'status' | 'at'>, now: number) =>
  r.status === 'booked' ? Math.max(0, Math.floor((now - startOf(r)) / MINUTE)) : 0;

/**
 * Where a booking is, as staff read it: still to come, due within the hour (arriving), past its
 * time (late), seated, cancelled, or a no-show.
 */
export type ReservationState =
  'upcoming' | 'arriving' | 'late' | Exclude<ReservationStatus, 'booked'>;

export function reservationState(r: Reservation, now: number): ReservationState {
  if (r.status !== 'booked') return r.status;
  if (lateBy(r, now) > 0) return 'late';
  return now >= startOf(r) - HOLD_BEFORE_MINUTES * MINUTE ? 'arriving' : 'upcoming';
}

/* ---------- The Reservations page ---------- */

/** Still to come, seated, cancelled or no-show, or every booking. */
export type ReservationFilter = 'upcoming' | 'seated' | 'closed' | 'all';

export const RESERVATION_FILTERS: readonly ReservationFilter[] = [
  'upcoming',
  'seated',
  'closed',
  'all',
];

const inFilter = (r: Reservation, filter: ReservationFilter) => {
  if (filter === 'upcoming') return r.status === 'booked';
  if (filter === 'seated') return r.status === 'seated';
  if (filter === 'closed') return r.status === 'cancelled' || r.status === 'noShow';
  return true;
};

/** A day's bookings, counted per filter. */
export function reservationCounts(
  reservations: readonly Reservation[],
): Record<ReservationFilter, number> {
  return {
    upcoming: reservations.filter((r) => inFilter(r, 'upcoming')).length,
    seated: reservations.filter((r) => inFilter(r, 'seated')).length,
    closed: reservations.filter((r) => inFilter(r, 'closed')).length,
    all: reservations.length,
  };
}

/** Guests expected on a day: every party booked or seated. */
export const guestCount = (reservations: readonly Reservation[]) =>
  reservations.filter(holdsTable).reduce((sum, r) => sum + r.partySize, 0);

/**
 * The bookings in a filter matching a search: the guest's name, the booking's number ("R1004"),
 * its table ("12") or part of the mobile number (four digits or more). By time.
 */
export function filterReservations(
  reservations: readonly Reservation[],
  filter: ReservationFilter,
  query: string,
): Reservation[] {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  return reservations
    .filter((r) => inFilter(r, filter))
    .filter(
      (r) =>
        !q ||
        r.guestName.toLowerCase().includes(q) ||
        r.id.toLowerCase() === q ||
        // A short number is a table ("12"); a longer one, part of a mobile number.
        (digits.length > 0 && digits.length <= 3 && String(r.table) === digits) ||
        (digits.length > 3 && (r.phone ?? '').includes(digits)),
    )
    .sort((a, b) => startOf(a) - startOf(b));
}

/** One day the page and the form offer: its calendar key and how many days from today. */
export interface BookingDay {
  /** "2026-10-17", the branch's calendar day. */
  key: string;
  /** 0 today, 1 tomorrow… */
  offset: number;
}

/** Today and the next days, in the branch's calendar. */
export function bookingDays(clock: Clock, now: Date, count = BOOKING_DAYS): BookingDay[] {
  return Array.from({ length: count }, (_, offset) => ({
    key: clock.dayKey(new Date(now.getTime() + offset * DAY)),
    offset,
  }));
}

/** Days from today to a calendar day ("2026-10-17"); negative for a day gone. */
export const dayOffset = (clock: Clock, now: Date, key: string) =>
  Math.round((Date.parse(key) - Date.parse(clock.dayKey(now))) / DAY);

/** The calendar day `days` after another: "2026-10-30" + 3 → "2026-11-02". */
export const addDays = (key: string, days: number) =>
  new Date(Date.parse(key) + days * DAY).toISOString().slice(0, 10);

/** The days a booking can be on: today until the furthest ahead the server takes one. */
export const bookingRange = (clock: Clock, now: Date) => {
  const min = clock.dayKey(now);
  return { min, max: addDays(min, MAX_DAYS_AHEAD) };
};

/**
 * A month ("2026-10") as weeks, Sunday first, for a calendar: each day's key, null before the
 * 1st and after the last day.
 */
export function monthWeeks(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const lead = new Date(Date.parse(first)).getUTCDay();
  const length = new Date(Date.parse(addDays(first, 32).slice(0, 7) + '-01') - DAY).getUTCDate();
  const cells = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** A month's name for a calendar: "October 2026". */
export const monthName = (month: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-15T12:00:00Z`),
  );

/** The month before or after one: "2026-12" + 1 → "2027-01". */
export const addMonths = (month: string, months: number) => {
  const at = new Date(`${month}-15T12:00:00Z`);
  at.setUTCMonth(at.getUTCMonth() + months);
  return at.toISOString().slice(0, 7);
};

/** A day's parts for a day chip: "Sat", "17", "Oct" (English, as dates are written elsewhere). */
export function dayParts(key: string) {
  const at = new Date(`${key}T12:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(at);
  return {
    weekday: part({ weekday: 'short' }),
    day: part({ day: 'numeric' }),
    month: part({ month: 'short' }),
  };
}

/** The bookings on a calendar day at the branch. */
export const onDay = (reservations: readonly Reservation[], clock: Clock, key: string) =>
  reservations.filter((r) => clock.dayKey(r.at) === key);

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The times a booking can start `offset` days from today: every 15 minutes in each of that day's
 * sessions, from its opening until an hour before it closes (past midnight when it runs on), and
 * today only from now on; none on a closed day. ISO with the branch's offset:
 * "2026-10-15T19:30:00+05:30".
 */
export function timeSlots(
  region: Pick<Branch, 'schedule' | 'locale' | 'timezone'>,
  offset: number,
  now: Date,
): string[] {
  const clock = createClock(region);
  // That day's sessions: a special date's, or its weekday's.
  const day = sessionsOn(
    region.schedule,
    clock.localTimestamp(-offset, '00:00', now).slice(0, 10),
    weekdayAt(new Date(now.getTime() + offset * DAY), region.timezone),
  );
  const slots: string[] = [];
  for (const { opens, closes } of day.map((s) => sessionMinutes(s))) {
    for (let m = opens; m <= closes - 60; m += SLOT_MINUTES) {
      // Past midnight, the next day's time.
      const ahead = Math.floor(m / (24 * 60));
      const time = m % (24 * 60);
      const at = clock.localTimestamp(
        -(offset + ahead),
        `${pad(Math.floor(time / 60))}:${pad(time % 60)}`,
        now,
      );
      if (Date.parse(at) >= now.getTime()) slots.push(at);
    }
  }
  return slots.sort();
}

/* ---------- The booking form ---------- */

export interface ReservationForm {
  guestName: string;
  /** National mobile digits. */
  phone: string;
  partySize: number;
  /** The calendar day picked ("2026-10-17"). */
  day: string;
  /** ISO, one of the day's times; '' until picked. */
  at: string;
  minutes: number;
  table: number | null;
  note: string;
}

/** The form for a new booking (today, the table given if any) or one being changed. */
export function reservationForm(
  clock: Clock,
  now: Date,
  from?: Reservation,
  table?: number,
): ReservationForm {
  if (from) {
    return {
      guestName: from.guestName,
      phone: from.phone ?? '',
      partySize: from.partySize,
      day: clock.dayKey(from.at),
      at: from.at,
      minutes: from.minutes,
      table: from.table,
      note: from.note ?? '',
    };
  }
  return {
    guestName: '',
    phone: '',
    partySize: 2,
    day: clock.dayKey(now),
    at: '',
    minutes: DEFAULT_MINUTES,
    table: table ?? null,
    note: '',
  };
}

/** Which form fields need a look, as content keys (common › adminReservations.editor.errors). */
export interface ReservationErrors {
  guestName?: 'name';
  phone?: PhoneError;
  at?: 'time';
  table?: 'table';
}

export function reservationErrors(form: ReservationForm, rules: MobileRules): ReservationErrors {
  const errors: ReservationErrors = {};
  if (!form.guestName.trim()) errors.guestName = 'name';
  const phone = form.phone ? mobileError(form.phone, rules) : null;
  if (phone) errors.phone = phone;
  if (!form.at) errors.at = 'time';
  if (form.table === null) errors.table = 'table';
  return errors;
}

/** The request for a checked form (the table is picked by then). */
export function reservationInput(form: ReservationForm): ReservationInput {
  return {
    table: form.table ?? 0,
    guestName: form.guestName.trim(),
    ...(form.phone ? { phone: form.phone } : {}),
    partySize: form.partySize,
    at: form.at,
    minutes: form.minutes,
    ...(form.note.trim() ? { note: form.note.trim() } : {}),
  };
}

/* ---------- The table picker ---------- */

export interface TableChoice {
  table: number;
  seats: number;
  /** The booking holding the table then: it can't be picked. */
  clash?: Reservation;
  /** Fewer seats than the party (it can still be picked: tables get pushed together). */
  tooSmall: boolean;
  /** The smallest free table that seats the party: the suggestion. */
  bestFit: boolean;
}

/** Every table by area, with whether it's free for the party then and which fits best. */
export function tableChoices(
  floors: readonly Pick<AdminFloor, 'id' | 'name' | 'tables'>[],
  reservations: readonly Reservation[],
  slot: { at: string; minutes: number; partySize: number },
  ignoreId?: string,
): { id: string; name: string; tables: TableChoice[] }[] {
  const choices = floors.map((floor) => ({
    id: floor.id,
    name: floor.name,
    // A table out of service can't be booked: it isn't offered.
    tables: floor.tables
      .filter((t) => !t.disabled)
      .map(({ table, seats }) => ({
        table,
        seats,
        clash: slot.at
          ? clashWith(reservations, { table, at: slot.at, minutes: slot.minutes }, ignoreId)
          : undefined,
        tooSmall: seats < slot.partySize,
        bestFit: false,
      })),
  }));
  const best = choices
    .flatMap((floor) => floor.tables)
    .filter((c) => !c.clash && !c.tooSmall)
    .sort((a, b) => a.seats - b.seats)[0];
  if (best) best.bestFit = true;
  return choices;
}
