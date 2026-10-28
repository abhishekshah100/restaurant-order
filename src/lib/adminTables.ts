import type { AdminFloor, AdminFloorTable, FloorTableStatus } from '@/types/admin';

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
