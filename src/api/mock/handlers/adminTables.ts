import { createClock } from '@/lib/clock';
import { amountDue } from '@/lib/lifecycle';
import { isFinished, isToday } from '@/lib/orders';
import { cleanLayout, disabledNumbers, layoutErrors, removedNumbers } from '@/lib/floorLayout';
import { bookingTables, isDue } from '@/lib/reservations';
import type {
  AdminFloorPlan,
  AdminFloorTable,
  AdminServiceRequest,
  AdminTableDetail,
  FloorLayout,
  FloorPlanLayout,
  FloorTableLayout,
  FloorTableStatus,
  Reservation,
  ReservationBrief,
} from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { Order } from '@/types/order';
import type { TableInUse, TableQrCodesResponse } from '../../contracts';
import { fail, isObject, ok, type Handler, type MockContext } from '../context';
import { branchReservations } from './adminReservations';
import { adminBranch } from './adminSessions';
import { floorActivity } from './adminService';

/*
 * The floor plan: every area of a branch with its tables and what's happening at each (GET
 * /admin/branches/:branchId/tables), and one table's open orders, requests and bookings (GET
 * /admin/branches/:branchId/tables/:table). And the floor plan itself as staff set it up in
 * Settings (GET and PATCH /admin/branches/:branchId/floors).
 */

const MINUTE = 60_000;

/* ---------- Deriving the floor plan (pure) ---------- */

export interface FloorPlanInput {
  layout: FloorPlanLayout;
  /** The branch's orders, as for GET /admin/branches/:branchId/service. */
  orders: readonly Order[];
  /** The branch's open requests. */
  requests: readonly AdminServiceRequest[];
  /** When staff last freed each table (ISO), by table number. */
  freedAt?: Readonly<Record<number, string>>;
  /** The branch's bookings (any day, any status). */
  reservations?: readonly Reservation[];
  branch: Branch;
  now: number;
}

/** Today's dine-in orders still open: not cancelled, and not both served and paid. Newest first. */
function openDineIn({ orders, branch, now }: FloorPlanInput): Order[] {
  const clock = createClock(branch);
  return orders
    .filter(
      (o) =>
        o.mode === 'dineIn' &&
        o.status !== 'cancelled' &&
        isToday(o.placedAt, new Date(now), clock) &&
        !(isFinished(o) && amountDue(o) === 0),
    )
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/** Today's dine-in orders served and paid in full: the guests may still be at the table. */
function settledDineIn({ orders, branch, now }: FloorPlanInput): Order[] {
  const clock = createClock(branch);
  return orders.filter(
    (o) =>
      o.mode === 'dineIn' &&
      o.status !== 'cancelled' &&
      isToday(o.placedAt, new Date(now), clock) &&
      isFinished(o) &&
      amountDue(o) === 0,
  );
}

/** What a table needs most: a waiter, the bill, food on the way, or nothing (eating, free). */
function statusOf(orders: readonly Order[], requests: readonly AdminServiceRequest[]) {
  let status: FloorTableStatus = 'available';
  if (orders.length > 0) status = orders.some((o) => !isFinished(o)) ? 'ordering' : 'eating';
  if (requests.some((r) => r.kind === 'bill')) status = 'wantsBill';
  if (requests.some((r) => r.kind === 'waiter')) status = 'needsWaiter';
  return status;
}

/** An order's latest activity: when its last round went to the kitchen. */
const lastPlaced = (order: Order) => order.rounds?.at(-1)?.placedAt ?? order.placedAt;

const brief = ({ id, guestName, partySize, at, status }: Reservation): ReservationBrief => ({
  id,
  guestName,
  partySize,
  at,
  status,
});

/**
 * A table's bookings now: today's still to come or seated (by time), the seated party that
 * hasn't ordered yet (seated by staff, not freed since, no order at the table since, within its
 * time), the booking it's held for (due within the hour, or a little late), and the next one.
 */
function bookingsAt(input: FloorPlanInput, number: number, since: (at: string) => boolean) {
  const { now, branch } = input;
  const clock = createClock(branch);
  const today = (input.reservations ?? [])
    .filter(
      (r) =>
        bookingTables(r).includes(number) &&
        (r.status === 'booked' || r.status === 'seated') &&
        clock.isSameDay(r.at, new Date(now)),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  const orderedSince = (at: string) =>
    input.orders.some((o) => o.mode === 'dineIn' && o.table === number && lastPlaced(o) >= at);
  const seated = today.find(
    (r) =>
      r.seatedAt !== undefined &&
      since(r.seatedAt) &&
      !orderedSince(r.seatedAt) &&
      now < Date.parse(r.seatedAt) + r.minutes * MINUTE,
  );
  const due = today.find((r) => isDue(r, now));
  const next = today.find((r) => r.status === 'booked' && Date.parse(r.at) > now);
  return { today, seated, due, next: due ?? next };
}

/**
 * One table now. Freed by staff (`freedAt`), only what came after counts, and the first order,
 * request or seated party after it clears the flag. Freed in the data itself (`layout.freed`,
 * the backend's flag with no time), nothing counts. With nothing going on, booked guests seated
 * make it `seated` and a booking due makes it `reserved`.
 */
function tableAt(
  input: FloorPlanInput,
  layout: FloorTableLayout,
  open: readonly Order[],
  freedAt: string | undefined,
) {
  const { number, seats } = layout;
  const since = (at: string) => !layout.freed && (!freedAt || at > freedAt);
  const orders = open.filter((o) => o.table === number && since(lastPlaced(o)));
  const asked = input.requests
    .filter((r) => r.table === number && since(r.requestedAt))
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const bookings = bookingsAt(input, number, since);
  let status: FloorTableStatus = statusOf(orders, asked);
  let booking = bookings.next;
  let seatedAt = orders.at(-1)?.placedAt;
  // Paying isn't leaving: served and paid, the guests keep the table until staff free it.
  const settled = settledDineIn(input).filter((o) => o.table === number && since(lastPlaced(o)));
  const seatedSince = bookings.seated?.seatedAt;
  const stillSeated =
    settled.length > 0 && !(seatedSince && settled.every((o) => lastPlaced(o) < seatedSince));
  if (status === 'available' && stillSeated) {
    status = 'paidSeated';
    seatedAt = settled.map((o) => o.placedAt).sort()[0];
  } else if (status === 'available' && bookings.seated) {
    status = 'seated';
    booking = bookings.seated;
    seatedAt = bookings.seated.seatedAt;
  } else if (status === 'available' && bookings.due) {
    status = 'reserved';
  }
  const disabled = layout.disabled === true;
  if (status === 'available' && disabled) status = 'outOfService';
  const freed =
    layout.freed ||
    (freedAt !== undefined &&
      orders.length === 0 &&
      asked.length === 0 &&
      !bookings.seated &&
      settled.length === 0);
  const table: AdminFloorTable = {
    table: number,
    seats,
    status,
    freed,
    disabled,
    orderCount: orders.length,
    due: orders.reduce((sum, o) => sum + amountDue(o), 0),
    ...(seatedAt ? { seatedAt } : {}),
    ...(booking ? { booking: brief(booking) } : {}),
  };
  return { table, orders, requests: asked, reservations: bookings.today };
}

/** GET /admin/branches/:branchId/tables's answer. */
export function floorPlan(input: FloorPlanInput): AdminFloorPlan {
  const open = openDineIn(input);
  return {
    floors: input.layout.floors.map(({ id, name, tables }) => ({
      id,
      name,
      tables: tables.map(
        (layout) => tableAt(input, layout, open, input.freedAt?.[layout.number]).table,
      ),
    })),
    generatedAt: new Date(input.now).toISOString(),
  };
}

/** GET /admin/branches/:branchId/tables/:table's answer; undefined if no area has the table. */
export function tableDetail(input: FloorPlanInput, number: number): AdminTableDetail | undefined {
  const floor = input.layout.floors.find((f) => f.tables.some((t) => t.number === number));
  const layout = floor?.tables.find((t) => t.number === number);
  if (!floor || !layout) return undefined;
  const { table, orders, requests, reservations } = tableAt(
    input,
    layout,
    openDineIn(input),
    input.freedAt?.[number],
  );
  return {
    ...table,
    floor: { id: floor.id, name: floor.name },
    orders,
    requests,
    reservations,
    generatedAt: new Date(input.now).toISOString(),
  };
}

/* ---------- Handlers ---------- */

/** When staff last freed each of the branch's tables, by table number. */
function freedTimes(ctx: MockContext, branch: Branch): Record<number, string> {
  const prefix = `${branch.id}:`;
  return Object.fromEntries(
    Object.entries(ctx.db.tablesFreed.read())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, at]) => [Number(key.slice(prefix.length)), at]),
  );
}

/** Everything the floor plan is worked out from, for a branch. */
async function floorInput(ctx: MockContext, branch: Branch): Promise<FloorPlanInput> {
  const [layout, activity] = await Promise.all([
    ctx.seed.floors(branch.id),
    floorActivity(ctx, branch),
  ]);
  return {
    layout,
    ...activity,
    freedAt: freedTimes(ctx, branch),
    reservations: branchReservations(ctx, branch),
    branch,
  };
}

/** The table number in the path, as one of the branch's tables, or 404. */
function tableNumber(input: FloorPlanInput, raw: string) {
  const number = Number(raw);
  const known = input.layout.floors.some((f) => f.tables.some((t) => t.number === number));
  if (!Number.isInteger(number) || !known) fail(404, 'not_found');
  return number;
}

/** GET /admin/branches/:branchId/tables */
export const branchFloorPlan: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  return ok(floorPlan(await floorInput(ctx, branch)));
};

/** GET /admin/branches/:branchId/tables/:table */
export const branchTable: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const input = await floorInput(ctx, branch);
  return ok(tableDetail(input, tableNumber(input, params.table)));
};

/** POST /admin/branches/:branchId/tables/:table/free */
export const freeTable: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const input = await floorInput(ctx, branch);
  const number = tableNumber(input, params.table);
  const at = new Date(ctx.now()).toISOString();
  ctx.db.tablesFreed.write({ ...ctx.db.tablesFreed.read(), [`${branch.id}:${number}`]: at });
  return ok(tableDetail({ ...input, freedAt: { ...input.freedAt, [number]: at } }, number));
};

/**
 * MOCK ONLY: the token printed on a table's QR code. A backend signs the branch and table with a
 * secret (an HMAC); the mock works one out from them so the same table always gets the same code.
 */
export function mockQrToken(branchId: string, table: number): string {
  let hash = 2166136261;
  for (const char of `${branchId}:${table}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  return `t${table}.${hash.toString(36)}`;
}

/** GET /admin/branches/:branchId/tables/qr-codes */
export const tableQrCodes: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const layout = await ctx.seed.floors(branch.id);
  const response: TableQrCodesResponse = {
    codes: layout.floors.flatMap((floor) =>
      floor.tables.map((t) => {
        const query = new URLSearchParams({
          branch: branch.id,
          table: String(t.number),
          qr: mockQrToken(branch.id, t.number),
        });
        return {
          table: t.number,
          seats: t.seats,
          floor: { id: floor.id, name: floor.name },
          path: `/?${query.toString()}`,
        };
      }),
    ),
  };
  return ok(response);
};

/* ---------- Settings › Floor plan ---------- */

/** Whether a body is a floor plan in the floors.json shape (every field there, of its type). */
function asLayout(body: unknown): FloorPlanLayout {
  const floors = isObject(body) && Array.isArray(body.floors) ? body.floors : null;
  const valid =
    floors?.every(
      (f: unknown) =>
        isObject(f) &&
        typeof f.id === 'string' &&
        typeof f.name === 'string' &&
        Array.isArray(f.tables) &&
        f.tables.every(
          (t: unknown) =>
            isObject(t) && typeof t.number === 'number' && typeof t.seats === 'number',
        ),
    ) ?? false;
  if (!floors || !valid) fail(400, 'invalid_request');
  return cleanLayout({
    floors: (floors as FloorLayout[]).map((f) => ({
      ...f,
      tables: f.tables.map(({ number, seats, freed, disabled }) => ({
        number,
        seats,
        freed: freed === true,
        ...(disabled === true ? { disabled: true } : {}),
      })),
    })),
  });
}

/**
 * The tables a new plan leaves out or takes out of service that can't be yet: an order at it
 * today that isn't finished or paid, or a booking that hasn't ended.
 */
function tablesInUse(
  input: FloorPlanInput,
  numbers: readonly number[],
  change: TableInUse['change'],
): TableInUse[] {
  const now = new Date(input.now);
  const clock = createClock(input.branch);
  return numbers.flatMap((number): TableInUse[] => {
    const open = input.orders.some(
      (o) =>
        o.mode === 'dineIn' &&
        o.table === number &&
        o.status !== 'cancelled' &&
        isToday(o.placedAt, now, clock) &&
        (!isFinished(o) || amountDue(o) > 0),
    );
    if (open) return [{ number, reason: 'openOrder', change }];
    const booked = (input.reservations ?? []).some(
      (r) =>
        bookingTables(r).includes(number) &&
        (r.status === 'booked' || r.status === 'seated') &&
        Date.parse(r.at) + r.minutes * MINUTE > input.now,
    );
    return booked ? [{ number, reason: 'booking', change }] : [];
  });
}

/** GET /admin/branches/:branchId/floors */
export const branchFloors: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  return ok(await ctx.seed.floors(branch.id));
};

/** PATCH /admin/branches/:branchId/floors */
export const updateFloors: Handler = async (ctx, { params, body, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const next = asLayout(body);
  if (layoutErrors(next).length > 0) fail(400, 'invalid_request');
  const input = await floorInput(ctx, branch);
  const inUse = [
    ...tablesInUse(input, removedNumbers(input.layout, next), 'removed'),
    ...tablesInUse(input, disabledNumbers(input.layout, next), 'disabled'),
  ];
  if (inUse.length > 0) fail(409, 'table_in_use', { tables: inUse });
  ctx.db.floorLayouts.write({ ...ctx.db.floorLayouts.read(), [branch.id]: next });
  return ok(next);
};
