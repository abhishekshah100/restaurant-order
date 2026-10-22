import { isSavedSession } from '@/lib/session';
import { STORAGE_KEYS, readJSON } from '@/lib/storage';

/**
 * `?sessionId=` with the guest's session saved on this device, for the guest reads the backend
 * answers only to their session (one of their orders, their table's bill, their payment) —
 * the device's session works like a cookie here. Empty when there is none (the server then
 * answers 400) or on the server.
 */
export function guestQuery(): string {
  if (typeof window === 'undefined') return '';
  const saved = readJSON(STORAGE_KEYS.session, isSavedSession);
  return saved ? `?sessionId=${encodeURIComponent(saved.id)}` : '';
}
