import type { AdminBranchService, AdminFloor, AdminFloorTable, Reservation } from '@/types/admin';
import type { Dish } from '@/types/menu';
import type { Order } from '@/types/order';
import { ledgerOf } from './adminPayments';
import { minutesSince } from './adminService';

/*
 * The waiter home's extra panels, pure: the counters' second lines, the floor at a glance (with
 * the tables that need a look), the bookings arriving soon, what can't be sold tonight and the
 * signed-in waiter's shift so far.
 */

/* ---------- Counters ---------- */

export interface CounterExtras {
  /** Minutes the oldest open waiter call / bill request / ready round has waited; null without. */
  oldestCall: number | null;
  oldestBill: number | null;
  oldestReady: number | null;
  /** Still to collect on today's orders. */
  unpaidAmount: number;
}

const oldest = (times: readonly string[], now: Date): number | null =>
  times.length ? Math.max(...times.map((t) => minutesSince(t, now))) : null;

export function counterExtras(
  service: Pick<AdminBranchService, 'requests' | 'orders'>,
  now: Date,
): CounterExtras {
  return {
    oldestCall: oldest(
      service.requests.filter((r) => r.kind === 'waiter').map((r) => r.requestedAt),
      now,
    ),
    oldestBill: oldest(
      service.requests.filter((r) => r.kind === 'bill').map((r) => r.requestedAt),
      now,
    ),
    oldestReady: oldest(
      service.orders.flatMap((o) => o.readyRounds.map((r) => r.readyAt)),
      now,
    ),
    unpaidAmount: service.orders.reduce((sum, o) => sum + o.due, 0),
  };
}

/* ---------- The floor ---------- */

/** Seated this long with nothing ordered: someone should take the order. */
export const NO_ORDER_MINUTES = 10;
/** Ordered this long ago with nothing served yet: check with the kitchen. */
export const LONG_WAIT_MINUTES = 25;

/** What a table needs a look for, beyond its state: no order yet, or a long wait for food. */
export type TableFlag = 'noOrder' | 'longWait' | null;

export function tableFlag(table: AdminFloorTable, now: Date): TableFlag {
  if (!table.seatedAt) return null;
  const minutes = minutesSince(table.seatedAt, now);
  if (table.status === 'seated' && minutes >= NO_ORDER_MINUTES) return 'noOrder';
  if (table.status === 'ordering' && minutes >= LONG_WAIT_MINUTES) return 'longWait';
  return null;
}

/** Calling, wanting the bill, or flagged. */
export const needsAttention = (table: AdminFloorTable, now: Date) =>
  table.status === 'needsWaiter' || table.status === 'wantsBill' || tableFlag(table, now) !== null;

/** Guests are at it: anything but free, reserved (not here yet) and out of service. */
const isBusy = (t: AdminFloorTable) =>
  t.status !== 'available' && t.status !== 'reserved' && t.status !== 'outOfService';

export interface FloorSummary {
  /** In service. */
  tables: number;
  busy: number;
  free: number;
  reserved: number;
  seats: number;
  seatsTaken: number;
  attention: number;
}

export function floorSummary(floors: readonly AdminFloor[], now: Date): FloorSummary {
  const all = floors.flatMap((f) => f.tables).filter((t) => t.status !== 'outOfService');
  const busy = all.filter(isBusy);
  return {
    tables: all.length,
    busy: busy.length,
    free: all.filter((t) => t.status === 'available').length,
    reserved: all.filter((t) => t.status === 'reserved').length,
    seats: all.reduce((n, t) => n + t.seats, 0),
    seatsTaken: busy.reduce((n, t) => n + t.seats, 0),
    attention: all.filter((t) => needsAttention(t, now)).length,
  };
}

export type FloorFilter = 'mine' | 'all' | 'attention' | 'free';
export const FLOOR_FILTERS: readonly FloorFilter[] = ['mine', 'all', 'attention', 'free'];

export function inFloorFilter(
  table: AdminFloorTable,
  filter: FloorFilter,
  now: Date,
  mine: ReadonlySet<number> = new Set(),
): boolean {
  if (filter === 'mine') return mine.has(table.table);
  if (filter === 'attention') return needsAttention(table, now);
  if (filter === 'free') return table.status === 'available';
  return true;
}

/* ---------- Bookings arriving soon ---------- */

/** How far ahead "Arriving soon" looks, and how late a booking can be and still be listed. */
export const ARRIVING_WINDOW_MINUTES = 120;
export const ARRIVING_LATE_MINUTES = 60;

/** Bookings still to come in the next two hours (and those up to an hour late), soonest first. */
export function arrivingSoon(reservations: readonly Reservation[], now: Date): Reservation[] {
  const t = now.getTime();
  return reservations
    .filter((r) => {
      if (r.status !== 'booked') return false;
      const at = Date.parse(r.at);
      return at <= t + ARRIVING_WINDOW_MINUTES * 60_000 && at >= t - ARRIVING_LATE_MINUTES * 60_000;
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/* ---------- Not available tonight ---------- */

/** Dishes sold out or off for today, by name. */
export const soldOutTonight = (dishes: readonly Dish[]): Dish[] =>
  dishes
    .filter((d) => d.availability.status !== 'available')
    .sort((a, b) => a.name.localeCompare(b.name));

/* ---------- My shift ---------- */

export interface ShiftSummary {
  /** Orders (not cancelled) with a round this person took at the table. */
  ordersTaken: number;
  /** The tables those orders were at. */
  tables: number;
  /** Payments this person took in person, and their total (tips apart). */
  payments: number;
  collected: number;
  tips: number;
}

/**
 * The signed-in staff member's day from today's orders, matched by their name; with `since`
 * (ISO: their shift's start), only what they did from then.
 */
export function myShift(orders: readonly Order[], name: string, since?: string): ShiftSummary {
  const me = name.trim().toLowerCase();
  const mine = (by: string | undefined) => me !== '' && by?.trim().toLowerCase() === me;
  const after = (at: string) => !since || at >= since;
  const taken = orders.filter(
    (o) =>
      o.status !== 'cancelled' &&
      (o.rounds ?? []).some((r) => mine(r.takenBy) && after(r.placedAt)),
  );
  const payments = orders
    .flatMap(ledgerOf)
    .filter((tx) => tx.kind === 'payment' && mine(tx.by) && after(tx.at));
  return {
    ordersTaken: taken.length,
    tables: new Set(taken.flatMap((o) => (o.table === undefined ? [] : [o.table]))).size,
    payments: payments.length,
    collected: payments.reduce((sum, tx) => sum + tx.amount, 0),
    tips: payments.reduce((sum, tx) => sum + (tx.tip ?? 0), 0),
  };
}
