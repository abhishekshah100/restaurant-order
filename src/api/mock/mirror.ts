import type { GuestSession } from '@/types/session';
import type { ApiRequest } from '../client';
import type { OtpChallenge } from '../contracts';
import { matchPath } from '../paths';
import type { MockDb } from './db';

/*
 * MOCK ONLY, while the backend is partly built. Guests' sessions and one-time codes live on the
 * backend, but what the mock still serves (orders, payments, service requests, promotions) looks
 * a session up — and whether its number is verified — in the mock's own tables. The backend's
 * answers are copied there, so those keep working. Delete this with the mock's orders.
 */

type Body = Record<string, unknown>;
const field = (body: unknown, key: string) => (body as Body | undefined)?.[key];

/** Copies a backend answer the mock depends on into its tables (any other is left alone). */
export function mirrorBackendAnswer(
  db: Pick<MockDb, 'sessions' | 'otp'>,
  request: ApiRequest,
  data: unknown,
) {
  const { method, path, body } = request;
  if (
    (method === 'POST' && path === 'sessions') ||
    (method === 'PATCH' && matchPath('sessions/:id', path))
  ) {
    const session = data as GuestSession;
    db.sessions.write([...db.sessions.read().filter((s) => s.id !== session.id), session]);
    return;
  }
  const sessionId = field(body, 'sessionId');
  if (method !== 'POST' || typeof sessionId !== 'string') return;
  const otp = db.otp.read();
  if (path === 'otp') {
    const challenge = data as OtpChallenge;
    const { phone, sentAt, attemptsLeft, verified } = challenge;
    db.otp.write({ ...otp, [sessionId]: { phone, sentAt, attemptsLeft, verified } });
  } else if (path === 'otp/verify' && otp[sessionId]) {
    db.otp.write({ ...otp, [sessionId]: { ...otp[sessionId], verified: true } });
  }
}
