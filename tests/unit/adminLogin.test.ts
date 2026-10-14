import { describe, expect, it } from 'vitest';
import type { ApiErrorBody, AdminSignInResponse } from '@/api/contracts';
import { DEMO_ADMIN } from '@/api/mock/demoAdmin';
import { matchesAdminIdentity } from '@/api/mock/handlers/adminSessions';
import { ADMIN_SESSION_HOURS, HOUR_MS } from '@/api/mock/rules';
import { adminLoginSchema, isAdminIdentity } from '@/lib/adminLogin';
import { createTestServer, readApiJson } from '../apiState';

const content = readApiJson<{
  adminLogin: {
    validation: { identityRequired: string; identityInvalid: string; passwordRequired: string };
  };
}>('content/common');
const messages = content.adminLogin.validation;
const schema = adminLoginSchema(messages);
const errorsFor = (identity: string, password = 'secret') => {
  const result = schema.safeParse({ identity, password });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('admin login form schema', () => {
  it('accepts an email', () => {
    expect(errorsFor('manager@example.com')).toEqual([]);
    expect(errorsFor('  manager@example.com  ')).toEqual([]);
  });

  it('accepts Indian, Nepali and other international mobile numbers', () => {
    for (const phone of [
      '9876543210',
      '+91 98765 43210',
      '+919876543210',
      '9812345678',
      '+977 981-2345678',
      '+44 7700 900123',
      '+1 (415) 555-0134',
    ]) {
      expect(isAdminIdentity(phone), phone).toBe(true);
    }
  });

  it('refuses anything else with the content messages', () => {
    expect(errorsFor('')).toEqual([messages.identityRequired]);
    expect(errorsFor('not-an-email')).toEqual([messages.identityInvalid]);
    expect(errorsFor('12345')).toEqual([messages.identityInvalid]);
    expect(errorsFor('+1234567890123456')).toEqual([messages.identityInvalid]);
    expect(errorsFor('manager@example.com', '')).toEqual([messages.passwordRequired]);
  });
});

describe('POST /admin/sessions (mock)', () => {
  const now = Date.parse('2026-10-14T10:00:00+05:30');
  const server = createTestServer(() => now);
  const signIn = (identity: string, password: string) =>
    server({ method: 'POST', path: 'admin/sessions', body: { identity, password } });

  it('signs in the demo admin by email or mobile number', async () => {
    for (const identity of [
      DEMO_ADMIN.email,
      DEMO_ADMIN.email.toUpperCase(),
      '9876543210',
      '+91 98765 43210',
    ]) {
      const res = await signIn(identity, DEMO_ADMIN.password);
      expect(res?.status, identity).toBe(201);
      const session = res?.body as AdminSignInResponse;
      expect(session.token).toBeTruthy();
      expect(session.admin).toEqual({
        name: DEMO_ADMIN.name,
        email: DEMO_ADMIN.email,
        phone: DEMO_ADMIN.phone,
      });
      expect(session.expiresAt).toBe(now + ADMIN_SESSION_HOURS * HOUR_MS);
      expect(JSON.stringify(session)).not.toContain(DEMO_ADMIN.password);
    }
  });

  it('answers 401 invalid_credentials for a wrong password', async () => {
    const res = await signIn(DEMO_ADMIN.email, 'wrong');
    expect(res?.status).toBe(401);
    expect((res?.body as ApiErrorBody).error).toBe('invalid_credentials');
  });

  it('answers 401 invalid_credentials for an unknown identity', async () => {
    for (const identity of ['someone@example.com', '9876543211', '+977 9876543210']) {
      const res = await signIn(identity, DEMO_ADMIN.password);
      expect(res?.status, identity).toBe(401);
      expect((res?.body as ApiErrorBody).error).toBe('invalid_credentials');
    }
  });

  it('answers 400 for a malformed body', async () => {
    const res = await server({ method: 'POST', path: 'admin/sessions', body: { identity: 'x' } });
    expect(res?.status).toBe(400);
  });

  it('matches only the full number or its national digits', () => {
    expect(matchesAdminIdentity(DEMO_ADMIN, '919876543210')).toBe(true);
    expect(matchesAdminIdentity(DEMO_ADMIN, '43210')).toBe(false);
  });
});
