'use client';

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { restaurant } from '@/data/restaurant';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';

/**
 * The table number comes from the QR URL (/?table=12). It's read on the client,
 * stored on the device and shown in the header on every screen.
 */

const listeners = new Set<() => void>();
let current: number | null = null;

const isTable = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 1000;

export function parseTable(raw: string | null): number | null {
  if (!raw || !/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return isTable(n) ? n : null;
}

function getSnapshot(): number {
  if (current === null) current = readJSON(STORAGE_KEYS.table, isTable) ?? restaurant.defaultTable;
  return current;
}

const getServerSnapshot = () => restaurant.defaultTable;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setTable(table: number) {
  current = table;
  writeJSON(STORAGE_KEYS.table, table);
  listeners.forEach((l) => l());
}

const TableContext = createContext<number>(restaurant.defaultTable);

export function TableProvider({ children }: { children: ReactNode }) {
  const table = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Pick up ?table=NN from the scanned QR link on first load.
  useEffect(() => {
    const fromUrl = parseTable(new URLSearchParams(window.location.search).get('table'));
    if (fromUrl !== null && fromUrl !== getSnapshot()) setTable(fromUrl);
  }, []);

  return <TableContext.Provider value={table}>{children}</TableContext.Provider>;
}

export function useTableContext(): number {
  return useContext(TableContext);
}
