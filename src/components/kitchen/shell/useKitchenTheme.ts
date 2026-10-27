'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';
import themes from '../kitchenTheme.module.css';

export type KitchenTheme = 'light' | 'dark';

/** Kitchens start dark (less glare at the pass); each device keeps its own choice. */
const DEFAULT_THEME: KitchenTheme = 'dark';

const isTheme = (value: unknown): value is KitchenTheme => value === 'light' || value === 'dark';

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab on the same screen switched it.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.kitchenTheme) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const read = (): KitchenTheme => readJSON(STORAGE_KEYS.kitchenTheme, isTheme) ?? DEFAULT_THEME;

/**
 * The kitchen screen's theme, light or dark, kept on this device (dark until changed), and a way
 * to switch it. The server renders the default; the device's own choice follows on hydration.
 */
export function useKitchenTheme(): [KitchenTheme, () => void] {
  const theme = useSyncExternalStore(subscribe, read, () => DEFAULT_THEME);
  const toggle = useCallback(() => {
    writeJSON(STORAGE_KEYS.kitchenTheme, read() === 'dark' ? 'light' : 'dark');
    listeners.forEach((l) => l());
  }, []);
  return [theme, toggle];
}

/**
 * The class that dresses something in the kitchen's theme: the shell, and the kitchen's own
 * pop-ups (they open outside the shell), so they match the screen.
 */
export function useKitchenThemeClass(): string {
  const [theme] = useKitchenTheme();
  return themes[theme];
}
