'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';

export const TEXT_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** How much a ticket is scaled at each text size. */
export const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.9,
  medium: 1,
  large: 1.15,
  xlarge: 1.3,
};

/** The kitchen screen's own settings, kept on this device (a wall screen and a tablet differ). */
export interface KitchenPrefs {
  /** A chime when a ticket comes in. */
  sound: boolean;
  /** A softer chime every minute while a ticket has waited in New over two minutes. */
  reminders: boolean;
  /** Keep the screen from dimming and locking while the kitchen pages are open. */
  awake: boolean;
  textSize: TextSize;
  /** Print each new ticket as it comes in (a kitchen order ticket, KOT). */
  autoPrint: boolean;
  /** The station this screen shows ("all", or a menu category's id). */
  station: string;
}

const DEFAULTS: KitchenPrefs = {
  sound: true,
  reminders: true,
  awake: true,
  textSize: 'medium',
  autoPrint: false,
  station: 'all',
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** What's stored, field by field: anything missing or wrong takes its default. */
function parse(stored: Record<string, unknown> | null): KitchenPrefs {
  if (!stored) return DEFAULTS;
  const bool = (key: keyof KitchenPrefs) =>
    typeof stored[key] === 'boolean' ? (stored[key] as boolean) : (DEFAULTS[key] as boolean);
  return {
    sound: bool('sound'),
    reminders: bool('reminders'),
    awake: bool('awake'),
    autoPrint: bool('autoPrint'),
    textSize: TEXT_SIZES.find((s) => s === stored.textSize) ?? DEFAULTS.textSize,
    station:
      typeof stored.station === 'string' && /^[a-z0-9-]{1,64}$/.test(stored.station)
        ? stored.station
        : DEFAULTS.station,
  };
}

const listeners = new Set<() => void>();
let cached: { raw: string | null; prefs: KitchenPrefs } | null = null;

/** The stored settings, the same object until they change (useSyncExternalStore needs that). */
function read(): KitchenPrefs {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEYS.kitchenPrefs);
  } catch {
    // Blocked storage: the defaults.
  }
  if (cached && cached.raw === raw) return cached.prefs;
  const prefs = parse(readJSON(STORAGE_KEYS.kitchenPrefs, isObject));
  cached = { raw, prefs };
  return prefs;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.kitchenPrefs) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * The kitchen screen's settings on this device, and a way to change some of them. The server
 * renders the defaults; the device's own follow on hydration.
 */
export function useKitchenPrefs(): [KitchenPrefs, (change: Partial<KitchenPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULTS);
  const update = useCallback((change: Partial<KitchenPrefs>) => {
    writeJSON(STORAGE_KEYS.kitchenPrefs, { ...read(), ...change });
    listeners.forEach((l) => l());
  }, []);
  return [prefs, update];
}
