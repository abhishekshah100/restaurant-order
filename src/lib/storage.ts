/**
 * Safe Web Storage access: never throws (private mode, blocked storage, SSR)
 * and validates parsed JSON with a guard before trusting it.
 */
type StorageKind = 'local' | 'session';

function store(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJSON<T>(
  key: string,
  isValid: (value: unknown) => value is T,
  kind: StorageKind = 'local',
): T | null {
  try {
    const raw = store(kind)?.getItem(key);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown, kind: StorageKind = 'local'): void {
  try {
    store(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or privacy mode — the app keeps working in memory.
  }
}

export function removeKey(key: string, kind: StorageKind = 'local'): void {
  try {
    store(kind)?.removeItem(key);
  } catch {
    // ignore
  }
}

export const STORAGE_KEYS = {
  cart: 'olive.cart.v2',
  session: 'olive.session.v1',
  checkout: 'olive.checkout.v1',
  orders: 'olive.orders.v1',
  justPlaced: 'olive.just-placed.v1',
  service: 'olive.service.v1',
  statusPreview: 'olive.status-preview.v1',
} as const;
