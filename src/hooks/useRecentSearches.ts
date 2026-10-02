'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { defaultRecentSearches } from '@/data/menu';
import { MAX_RECENT_SEARCHES } from '@/lib/constants';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';

const listeners = new Set<() => void>();
let cache: string[] | null = null;

const isStringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string');

function read(): string[] {
  if (cache === null)
    cache = readJSON(STORAGE_KEYS.recentSearches, isStringList) ?? defaultRecentSearches;
  return cache;
}

function write(next: string[]) {
  cache = next;
  writeJSON(STORAGE_KEYS.recentSearches, next);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Recent searches saved on this device (newest first, de-duplicated, capped). */
export function useRecentSearches() {
  const recent = useSyncExternalStore(subscribe, read, () => defaultRecentSearches);

  const add = useCallback((query: string) => {
    const q = query.trim();
    if (q.length < 2) return;
    const rest = read().filter((r) => r.toLowerCase() !== q.toLowerCase());
    write([q, ...rest].slice(0, MAX_RECENT_SEARCHES));
  }, []);

  const remove = useCallback((query: string) => write(read().filter((r) => r !== query)), []);
  const clear = useCallback(() => write([]), []);

  return { recent, add, remove, clear };
}
