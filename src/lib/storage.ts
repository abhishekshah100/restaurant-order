/**
 * Safe Web Storage access: never throws (private mode, blocked storage, SSR)
 * and validates parsed JSON with a guard before trusting it.
 */
export type StorageKind = 'local' | 'session';

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

const PROBE = 'olive.probe';
const available: Partial<Record<StorageKind, boolean>> = {};

/** Whether the storage can be written at all (blocked in some privacy modes). Checked once. */
export function storageAvailable(kind: StorageKind = 'local'): boolean {
  if (typeof window === 'undefined') return false;
  if (available[kind] === undefined) {
    try {
      const s = store(kind);
      s?.setItem(PROBE, PROBE);
      s?.removeItem(PROBE);
      available[kind] = s !== null;
    } catch {
      available[kind] = false;
    }
  }
  return available[kind];
}

/** The app's own device state. The mock server's tables have their keys in api/mock/db. */
export const STORAGE_KEYS = {
  cart: 'olive.cart.v2',
  session: 'olive.session.v1',
  /** A session (QR scan or chosen outlet) still being opened (survives a reload meanwhile). */
  pendingScan: 'olive.pending-scan.v1',
  checkout: 'olive.checkout.v1',
  justPlaced: 'olive.just-placed.v1',
  /** Delivery addresses remembered on this device, per branch. */
  addresses: 'olive.addresses.v1',
  statusPreview: 'olive.status-preview.v1',
} as const;
