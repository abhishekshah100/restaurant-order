import type { AdminBranch } from '@/types/admin';
import type { Branch, OrderMode } from '@/types/branch';
import type { AdminBranchesResponse, AdminSignInResponse } from '../../contracts';
import { fail, objectBody, ok, stringField, type Handler, type MockContext } from '../context';
import { DEMO_ADMIN } from '../demoAdmin';
import { ADMIN_SESSION_HOURS, HOUR_MS } from '../rules';

const digits = (value: string) => value.replace(/\D/g, '');

/** The staff accounts the mock knows (a backend keeps these in its database). */
const ACCOUNTS = [DEMO_ADMIN];

/**
 * Whether a typed email or mobile number is this account's: the email in any case, or the
 * phone in international form (with or without "+") or its national digits.
 */
export function matchesAdminIdentity(account: { email: string; phone: string }, identity: string) {
  const typed = identity.trim();
  if (typed.includes('@')) return typed.toLowerCase() === account.email.toLowerCase();
  const typedDigits = digits(typed);
  const phoneDigits = digits(account.phone);
  return typedDigits.length >= 10 && phoneDigits.endsWith(typedDigits);
}

/** POST /admin/sessions */
export const createAdminSession: Handler = async (ctx, { body: raw }) => {
  const body = objectBody(raw);
  const identity = stringField(body, 'identity');
  const password = stringField(body, 'password');
  const account = ACCOUNTS.find((a) => matchesAdminIdentity(a, identity));
  if (!account || password !== account.password) fail(401, 'invalid_credentials');
  const { name, email, phone } = account;
  const session: AdminSignInResponse = {
    token: ctx.newId(),
    admin: { name, email, phone },
    expiresAt: ctx.now() + ADMIN_SESSION_HOURS * HOUR_MS,
  };
  const now = ctx.now();
  ctx.db.adminSessions.write([
    ...ctx.db.adminSessions.read().filter((s) => s.expiresAt > now),
    { token: session.token, email, expiresAt: session.expiresAt },
  ]);
  return ok(session, 201);
};

/** The account behind the request's `Authorization: Bearer <token>`, or 401 unauthorized. */
export function signedInAccount(ctx: MockContext, headers: Record<string, string>) {
  const token = /^Bearer\s+(\S+)$/i.exec(headers.authorization ?? '')?.[1];
  const session = token && ctx.db.adminSessions.read().find((s) => s.token === token);
  const account = session && ACCOUNTS.find((a) => a.email === session.email);
  if (!session || session.expiresAt <= ctx.now() || !account) fail(401, 'unauthorized');
  return account;
}

const MODE_ORDER: OrderMode[] = ['dineIn', 'takeaway', 'delivery'];

/** A branch as the admin picker needs it. */
export function toAdminBranch(branch: Branch): AdminBranch {
  return {
    id: branch.id,
    name: branch.name,
    shortName: branch.shortName,
    city: branch.city,
    country: branch.country,
    address: branch.address,
    status: branch.status,
    hoursToday: branch.hoursToday,
    timezone: branch.timezone,
    locale: branch.locale,
    tables: branch.tables,
    modes: MODE_ORDER.filter((mode) => branch.modes[mode].enabled),
    currencyCode: branch.currency.code,
    ...(branch.image ? { image: branch.image } : {}),
  };
}

/** GET /admin/branches */
export const listAdminBranches: Handler = async (ctx, { headers }) => {
  const account = signedInAccount(ctx, headers);
  const branches = await ctx.seed.branches();
  const statusOverride = ctx.db.branchStatus.read();
  const body: AdminBranchesResponse = {
    branches: account.branchIds.flatMap((id) => {
      const branch = branches.find((b) => b.id === id);
      if (!branch) return [];
      return [{ ...toAdminBranch(branch), status: statusOverride[id] ?? branch.status }];
    }),
  };
  return ok(body);
};

/**
 * The branch, when the signed-in admin manages it: 401 unauthorized without a live session,
 * 403 forbidden for a branch that isn't theirs (or doesn't exist).
 */
export async function adminBranch(
  ctx: MockContext,
  headers: Record<string, string>,
  branchId: string | undefined,
): Promise<Branch> {
  const account = signedInAccount(ctx, headers);
  const branch = (await ctx.seed.branches()).find((b) => b.id === branchId);
  if (!branch || !account.branchIds.includes(branch.id)) fail(403, 'forbidden');
  return branch;
}
