import { fromSaved, isLiveSession, isSavedSession } from '@/lib/session';
import { STORAGE_KEYS, readJSON } from '@/lib/storage';
import type { Branch } from '@/types/branch';
import type { GuestSession } from '@/types/session';
import type { ApiResponse } from '../client';
import type { ApiErrorBody, ApiErrorCode } from '../contracts';
import type { MockDb } from './db';
import type { MockSeed } from './seed';

/** Everything a handler works with. Tests pass their own clock, ids, tables and seed. */
export interface MockContext {
  db: MockDb;
  seed: MockSeed;
  /** Epoch ms. */
  now(): number;
  newId(): string;
}

/** A request as a handler sees it: the path's `:params` and the parsed JSON body. */
export interface MockRequest {
  params: Record<string, string>;
  body: unknown;
}

export type Handler = (ctx: MockContext, req: MockRequest) => Promise<ApiResponse>;

/** Thrown by a handler to answer with an error status and body. */
export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error);
  }
}

export function fail(
  status: number,
  error: ApiErrorCode,
  extra?: Omit<ApiErrorBody, 'error'>,
): never {
  throw new MockHttpError(status, { error, ...extra });
}

export const ok = (body?: unknown, status = 200): ApiResponse => ({ status, body });

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

/** The body as an object, or 400. */
export function objectBody(body: unknown): Record<string, unknown> {
  if (!isObject(body)) fail(400, 'invalid_request');
  return body;
}

export function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value === '') fail(400, 'invalid_request');
  return value;
}

/**
 * A live session and its branch, or 404 session_not_found. Sessions opened before the mock
 * server existed (or seeded straight into storage by a test) are adopted from the device's
 * saved session, which a real backend would never need.
 */
export async function liveSession(
  ctx: MockContext,
  id: string,
): Promise<{ session: GuestSession; branch: Branch }> {
  const [branches, defaultBranchId] = await Promise.all([
    ctx.seed.branches(),
    ctx.seed.defaultBranchId(),
  ]);
  const saved = readJSON(STORAGE_KEYS.session, isSavedSession);
  const adopted = saved?.id === id ? fromSaved(saved, defaultBranchId) : null;
  const session = ctx.db.sessions.read().find((s) => s.id === id) ?? adopted;
  const branch = session && branches.find((b) => b.id === session.branchId);
  if (!session || !branch || !isLiveSession(session, ctx.now())) fail(404, 'session_not_found');
  return { session, branch };
}

/** A random id: a UUID where the browser offers one (secure contexts only), else 128 random bits. */
export function randomId(): string {
  const { crypto } = globalThis;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
