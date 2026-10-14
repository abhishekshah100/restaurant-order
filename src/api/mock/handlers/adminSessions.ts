import type { AdminSignInResponse } from '../../contracts';
import { fail, objectBody, ok, stringField, type Handler } from '../context';
import { DEMO_ADMIN } from '../demoAdmin';
import { ADMIN_SESSION_HOURS, HOUR_MS } from '../rules';

const digits = (value: string) => value.replace(/\D/g, '');

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
  if (!matchesAdminIdentity(DEMO_ADMIN, identity) || password !== DEMO_ADMIN.password) {
    fail(401, 'invalid_credentials');
  }
  const { name, email, phone } = DEMO_ADMIN;
  const session: AdminSignInResponse = {
    token: ctx.newId(),
    admin: { name, email, phone },
    expiresAt: ctx.now() + ADMIN_SESSION_HOURS * HOUR_MS,
  };
  return ok(session, 201);
};
