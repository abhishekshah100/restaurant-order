'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useBranch } from '@/api/hooks';
import { deliveryAreas } from '@/lib/fulfilment';
import { isDeliveryAddress, rememberAddress } from '@/lib/addresses';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';
import type { DeliveryAddress } from '@/types/order';

type SavedAddresses = Record<string, DeliveryAddress[]>;

const isSaved = (v: unknown): v is SavedAddresses =>
  typeof v === 'object' &&
  v !== null &&
  Object.values(v).every((list) => Array.isArray(list) && list.every(isDeliveryAddress));

const NONE: SavedAddresses = {};
const listeners = new Set<() => void>();
let cached: SavedAddresses | null = null;

const read = () => (cached ??= readJSON(STORAGE_KEYS.addresses, isSaved) ?? NONE);

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab remembered an address.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEYS.addresses) return;
    cached = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Delivery addresses remembered on this device (device state, like the cart), newest first,
 * per branch: only ones in an area the active branch still delivers to. None in the
 * prerendered HTML and the first client render.
 */
export function useSavedAddresses(): {
  addresses: DeliveryAddress[];
  remember: (address: DeliveryAddress) => void;
} {
  const branch = useBranch();
  const all = useSyncExternalStore(subscribe, read, () => NONE);
  const areas = deliveryAreas(branch.modes.delivery.zones);
  const addresses = (all[branch.id] ?? []).filter((a) => areas.includes(a.area));

  const remember = useCallback(
    (address: DeliveryAddress) => {
      const saved = readJSON(STORAGE_KEYS.addresses, isSaved) ?? NONE;
      const next = { ...saved, [branch.id]: rememberAddress(saved[branch.id] ?? [], address) };
      writeJSON(STORAGE_KEYS.addresses, next);
      cached = next;
      listeners.forEach((l) => l());
    },
    [branch.id],
  );

  return { addresses, remember };
}
