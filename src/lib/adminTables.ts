import type { AdminFloor, AdminFloorTable, FloorTableStatus, TableWaiter } from '@/types/admin';

/*
 * The floor plan's logic, pure: which area is open, the legend's five groups and their counts,
 * and how long guests have been seated.
 */

/** The legend's groups: seated, waiting for food, eating and paid-still-seated are "Occupied". */
export type FloorLegend =
  'available' | 'reserved' | 'occupied' | 'needsWaiter' | 'wantsBill' | 'outOfService';

export const FLOOR_LEGEND: readonly FloorLegend[] = [
  'available',
  'reserved',
  'occupied',
  'needsWaiter',
  'wantsBill',
  'outOfService',
];

export const legendOf = (status: FloorTableStatus): FloorLegend =>
  status === 'ordering' || status === 'eating' || status === 'seated' || status === 'paidSeated'
    ? 'occupied'
    : status;

/** How many tables are in each legend group. */
export function legendCounts(tables: readonly AdminFloorTable[]): Record<FloorLegend, number> {
  const counts: Record<FloorLegend, number> = {
    available: 0,
    reserved: 0,
    occupied: 0,
    needsWaiter: 0,
    wantsBill: 0,
    outOfService: 0,
  };
  for (const table of tables) counts[legendOf(table.status)] += 1;
  return counts;
}

/** The area named in the address, else the first. */
export const openFloor = (floors: readonly AdminFloor[], id: string | null) =>
  floors.find((floor) => floor.id === id) ?? floors[0];

/** Seated time as content keys: under a minute, minutes, or hours and minutes. */
export type SeatedFor =
  | { key: 'now' }
  | { key: 'minutes'; count: number }
  | { key: 'hours'; hours: number; minutes: number };

export function seatedFor(minutes: number): SeatedFor {
  if (minutes < 1) return { key: 'now' };
  if (minutes < 60) return { key: 'minutes', count: minutes };
  return { key: 'hours', hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/* ---------- Table sections ---------- */

/** "Arjun Waiter" → "AW", "priya" → "P": a waiter on a small tile. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/** Who is signed in: their id (newer sessions) and name (older ones match by it). */
export interface Me {
  id?: string;
  name?: string;
}

/** Whether a waiter is the signed-in staff member. */
export function isMe(waiter: TableWaiter | undefined, me: Me): boolean {
  if (!waiter) return false;
  if (me.id) return waiter.id === me.id;
  return !!me.name && waiter.name.trim().toLowerCase() === me.name.trim().toLowerCase();
}

/** The tables the signed-in staff member covers. */
export const myTables = (floors: readonly AdminFloor[], me: Me): Set<number> =>
  new Set(
    floors
      .flatMap((f) => f.tables)
      .filter((t) => isMe(t.waiter, me))
      .map((t) => t.table),
  );

/**
 * The tables the signed-in staff member covers, and those someone else covers, from the service
 * board's sections. With no tables of their own, `mine` is empty and nothing is "someone else's"
 * to them (they see and hear everything, as before sections).
 */
export function sectionsFor(
  sections: readonly { table: number; waiter: TableWaiter }[] | undefined,
  me: Me,
): { mine: Set<number>; others: Set<number> } {
  const mine = new Set<number>();
  const others = new Set<number>();
  for (const s of sections ?? []) (isMe(s.waiter, me) ? mine : others).add(s.table);
  return { mine, others: mine.size > 0 ? others : new Set() };
}
