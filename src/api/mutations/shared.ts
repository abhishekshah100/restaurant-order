'use client';

import { ApiError } from '../client';

/* ---------- Shared ---------- */

/** The admin's token, or a 401 like the server's when signed out. */
export function requireToken(token: string | null): string {
  if (!token) throw new ApiError(401, 'admin', { error: 'unauthorized' });
  return token;
}
