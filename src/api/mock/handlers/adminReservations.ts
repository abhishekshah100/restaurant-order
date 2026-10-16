import { createClock } from '@/lib/clock';
import { mobileError } from '@/lib/phone';
import {
  DEFAULT_MINUTES,
  DURATIONS,
  MAX_DAYS_AHEAD,
  MAX_NAME,
  MAX_NOTE,
  MAX_PARTY,
  canMarkNoShow,
  canSeat,
  clashWith,
} from '@/lib/reservations';
import type { Reservation, ReservationStatus } from '@/types/admin';
import type { Branch } from '@/types/branch';
import type { ReservationsResponse } from '../../contracts';
import { fail, objectBody, ok, type Handler, type MockContext } from '../context';
import { isDemoFloorOn } from '../demoFloor';
import { demoReservations } from '../demoReservations';
import { assertTableInService } from '../tableService';
import { adminBranch, signedInAccount } from './adminSessions';

/*
 * Bookings: the list from today on (GET /admin/branches/:branchId/reservations), a new one
 * (POST), a change (PATCH …/:id) and a change of status (PATCH …/:id/status). The floor plan
 * reads them too (handlers/adminTables).
 */

const MINUTE = 60_000;
/** A booking a few minutes in the past is still taken (the party is at the door). */
const PAST_GRACE_MINUTES = 15;

/** The branch's bookings; under `npm run dev`, a branch with none yet starts with samples. */
export function branchReservations(ctx: MockContext, branch: Branch): Reservation[] {
  const all = ctx.db.reservations.read();
  const own = all[branch.id];
  if (own) return own;
  if (!isDemoFloorOn()) return [];
  const seeded = demoReservations(branch, ctx.now());
  ctx.db.reservations.write({ ...all, [branch.id]: seeded });
  return seeded;
}

function saveReservations(ctx: MockContext, branch: Branch, list: Reservation[]) {
  ctx.db.reservations.write({ ...ctx.db.reservations.read(), [branch.id]: list });
}

/** The next booking number at the branch: R1001, R1002… never reused. */
function nextId(list: readonly Reservation[]) {
  const highest = Math.max(1000, ...list.map((r) => Number(r.id.slice(1)) || 0));
  return `R${highest + 1}`;
}

/** The booking in the path, or 404. */
function findReservation(list: readonly Reservation[], id: string | undefined) {
  const found = list.find((r) => r.id === id);
  if (!found) fail(404, 'not_found');
  return found;
}

/** 409 table_taken when another booking holds the table then. */
function assertFree(list: readonly Reservation[], booking: Reservation) {
  const clash = clashWith(list, booking, booking.id);
  if (clash) {
    fail(409, 'table_taken', {
      reservation: { id: clash.id, guestName: clash.guestName, at: clash.at },
    });
  }
}

const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim() !== '' && v.length <= max;

/**
 * A booking's details from the body, checked (400 invalid_request), with the table one of the
 * branch's (404 not_found).
 */
async function bookingFields(ctx: MockContext, branch: Branch, body: unknown) {
  const raw = objectBody(body);
  const now = ctx.now();
  const at = typeof raw.at === 'string' ? Date.parse(raw.at) : NaN;
  const minutes = raw.minutes ?? DEFAULT_MINUTES;
  const valid =
    Number.isInteger(raw.table) &&
    isText(raw.guestName, MAX_NAME) &&
    (raw.phone === undefined ||
      (typeof raw.phone === 'string' && mobileError(raw.phone, branch.mobile) === null)) &&
    Number.isInteger(raw.partySize) &&
    Number(raw.partySize) >= 1 &&
    Number(raw.partySize) <= MAX_PARTY &&
    at >= now - PAST_GRACE_MINUTES * MINUTE &&
    at <= now + MAX_DAYS_AHEAD * 24 * 60 * MINUTE &&
    DURATIONS.some((d) => d === minutes) &&
    (raw.note === undefined || (typeof raw.note === 'string' && raw.note.length <= MAX_NOTE));
  if (!valid) fail(400, 'invalid_request');
  const table = Number(raw.table);
  const layout = await ctx.seed.floors(branch.id);
  if (!layout.floors.some((f) => f.tables.some((t) => t.number === table))) {
    fail(404, 'not_found');
  }
  await assertTableInService(ctx, branch.id, table);
  const note = typeof raw.note === 'string' ? raw.note.trim() : '';
  return {
    table,
    guestName: String(raw.guestName).trim(),
    ...(typeof raw.phone === 'string' ? { phone: raw.phone } : {}),
    partySize: Number(raw.partySize),
    at: new Date(at).toISOString(),
    minutes: Number(minutes),
    ...(note ? { note } : {}),
  };
}

/* ---------- Handlers ---------- */

/** GET /admin/branches/:branchId/reservations */
export const listReservations: Handler = async (ctx, { params, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const now = new Date(ctx.now());
  const startOfToday = Date.parse(createClock(branch).localTimestamp(0, '00:00', now));
  const response: ReservationsResponse = {
    reservations: branchReservations(ctx, branch)
      .filter((r) => Date.parse(r.at) >= startOfToday)
      .sort((a, b) => a.at.localeCompare(b.at)),
    generatedAt: now.toISOString(),
  };
  return ok(response);
};

/** POST /admin/branches/:branchId/reservations */
export const createReservation: Handler = async (ctx, { params, body, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const { name } = signedInAccount(ctx, headers);
  const fields = await bookingFields(ctx, branch, body);
  const list = branchReservations(ctx, branch);
  const booking: Reservation = {
    id: nextId(list),
    ...fields,
    status: 'booked',
    createdAt: new Date(ctx.now()).toISOString(),
    createdBy: name,
  };
  assertFree(list, booking);
  saveReservations(ctx, branch, [...list, booking]);
  return ok(booking, 201);
};

/** PATCH /admin/branches/:branchId/reservations/:id */
export const updateReservation: Handler = async (ctx, { params, body, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const list = branchReservations(ctx, branch);
  const current = findReservation(list, params.id);
  const fields = await bookingFields(ctx, branch, body);
  if (current.status !== 'booked') fail(409, 'reservation_closed');
  // A field left out of the body is cleared (the form sends the booking whole).
  const { phone: _phone, note: _note, ...kept } = current;
  const booking: Reservation = { ...kept, ...fields };
  assertFree(list, booking);
  saveReservations(
    ctx,
    branch,
    list.map((r) => (r.id === booking.id ? booking : r)),
  );
  return ok(booking);
};

/** Whether a booking can go from where it is to `next` now. */
function canMove(current: Reservation, next: ReservationStatus, now: number) {
  if (next === 'seated') return canSeat(current, now);
  if (next === 'noShow') return canMarkNoShow(current, now);
  if (next === 'cancelled') return current.status === 'booked';
  return current.status === 'cancelled' || current.status === 'noShow';
}

const STATUSES: readonly ReservationStatus[] = ['booked', 'seated', 'cancelled', 'noShow'];

/** PATCH /admin/branches/:branchId/reservations/:id/status */
export const setReservationStatus: Handler = async (ctx, { params, body, headers }) => {
  const branch = await adminBranch(ctx, headers, params.branchId);
  const { name } = signedInAccount(ctx, headers);
  const next = STATUSES.find((s) => s === objectBody(body).status);
  if (!next) return fail(400, 'invalid_request');
  const list = branchReservations(ctx, branch);
  const current = findReservation(list, params.id);
  const now = ctx.now();
  if (!canMove(current, next, now)) fail(409, 'reservation_closed');
  const at = new Date(now).toISOString();
  const { seatedAt: _seatedAt, ...rest } = current;
  const booking: Reservation = {
    ...rest,
    status: next,
    ...(next === 'seated' ? { seatedAt: at } : {}),
    updatedAt: at,
    updatedBy: name,
  };
  if (next === 'booked') assertFree(list, booking);
  saveReservations(
    ctx,
    branch,
    list.map((r) => (r.id === booking.id ? booking : r)),
  );
  return ok(booking);
};
