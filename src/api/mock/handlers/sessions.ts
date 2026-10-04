import { deliveryAreas, isOrderMode } from '@/lib/fulfilment';
import { isTableAt } from '@/lib/scan';
import { isLiveSession } from '@/lib/session';
import type { Branch } from '@/types/branch';
import type { GuestSession } from '@/types/session';
import { fail, liveSession, objectBody, ok, stringField, type Handler } from '../context';
import { HOUR_MS, TABLE_SESSION_HOURS } from '../rules';

/** QR tokens are opaque (e.g. a JWT); the mock keeps them but doesn't check a signature. */
const QR_TOKEN = /^[\w.~-]{1,512}$/;

/** A delivery area the branch serves, or 422 area_not_served (undefined when none is given). */
function servedArea(branch: Branch, area: unknown): string | undefined {
  if (area === undefined) return undefined;
  if (typeof area !== 'string') fail(400, 'invalid_request');
  if (!deliveryAreas(branch.modes.delivery.zones).includes(area)) fail(422, 'area_not_served');
  return area;
}

/** POST /sessions */
export const createSession: Handler = async (ctx, { body: raw }) => {
  const body = objectBody(raw);
  const branchId = stringField(body, 'branchId');
  const { table, qrToken, mode, deliveryArea } = body;
  const branch = (await ctx.seed.branches()).find((b) => b.id === branchId);
  const atTable = typeof table === 'number' && branch !== undefined && isTableAt(branch, table);
  if (
    !branch ||
    !isOrderMode(mode) ||
    !branch.modes[mode].enabled ||
    // A table only comes with a QR scan: dine-in.
    (mode === 'dineIn' ? !atTable : table !== undefined) ||
    (qrToken !== undefined && (typeof qrToken !== 'string' || !QR_TOKEN.test(qrToken))) ||
    (deliveryArea !== undefined && mode !== 'delivery')
  ) {
    fail(400, 'invalid_request');
  }
  const area = servedArea(branch, deliveryArea);
  const now = ctx.now();
  const session: GuestSession = {
    id: ctx.newId(),
    branchId,
    mode,
    ...(mode === 'dineIn' ? { table: table as number } : {}),
    ...(area ? { deliveryArea: area } : {}),
    startedAt: now,
    expiresAt: now + TABLE_SESSION_HOURS * HOUR_MS,
    ...(qrToken ? { qrToken } : {}),
  };
  // Expired sessions are dropped as new ones open, so the table stays small.
  const live = ctx.db.sessions.read().filter((s) => isLiveSession(s, now));
  ctx.db.sessions.write([...live, session]);
  return ok(session, 201);
};

/** PATCH /sessions/:id */
export const updateSession: Handler = async (ctx, { params, body: raw }) => {
  const body = objectBody(raw);
  const { session, branch } = await liveSession(ctx, params.id);
  const mode = body.mode ?? session.mode;
  if (!isOrderMode(mode)) fail(400, 'invalid_request');
  // Dine-in needs the table a QR code was scanned at.
  if (!branch.modes[mode].enabled || (mode === 'dineIn' && session.table === undefined)) {
    fail(409, 'mode_unavailable');
  }
  const area = servedArea(branch, body.deliveryArea) ?? session.deliveryArea;
  const updated: GuestSession = {
    ...session,
    mode,
    ...(area ? { deliveryArea: area } : {}),
  };
  const others = ctx.db.sessions.read().filter((s) => s.id !== session.id);
  ctx.db.sessions.write([...others, updated]);
  return ok(updated);
};
