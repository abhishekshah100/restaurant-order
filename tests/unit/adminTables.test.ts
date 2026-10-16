import { describe, expect, it } from 'vitest';
import { floorPath, tablePath } from '@/lib/adminNav';
import { legendCounts, legendOf, openFloor, seatedFor } from '@/lib/adminTables';
import type { AdminFloor, AdminFloorTable, FloorTableStatus } from '@/types/admin';

/* The floor plan's pure logic: legend groups and counts, the open area, seated time, paths. */

const table = (number: number, status: FloorTableStatus): AdminFloorTable => ({
  table: number,
  seats: 4,
  status,
  freed: false,
  disabled: status === 'outOfService',
  orderCount: status === 'available' || status === 'outOfService' ? 0 : 1,
  due: 0,
});

const floors: AdminFloor[] = [
  { id: 'ground', name: 'Ground floor', tables: [table(1, 'available'), table(2, 'eating')] },
  { id: 'outdoor', name: 'Outdoor', tables: [table(9, 'needsWaiter')] },
];

describe('floor plan helpers', () => {
  it('groups seated, waiting for food and eating as occupied; reserved on its own', () => {
    expect(legendOf('seated')).toBe('occupied');
    expect(legendOf('ordering')).toBe('occupied');
    expect(legendOf('eating')).toBe('occupied');
    expect(legendOf('reserved')).toBe('reserved');
    expect(legendOf('wantsBill')).toBe('wantsBill');
    expect(legendOf('outOfService')).toBe('outOfService');
    expect(
      legendCounts([
        table(1, 'available'),
        table(2, 'ordering'),
        table(3, 'eating'),
        table(4, 'needsWaiter'),
        table(5, 'available'),
        table(6, 'reserved'),
        table(7, 'seated'),
        table(8, 'outOfService'),
      ]),
    ).toEqual({
      available: 2,
      reserved: 1,
      occupied: 3,
      needsWaiter: 1,
      wantsBill: 0,
      outOfService: 1,
    });
  });

  it('opens the area in the address, else the first', () => {
    expect(openFloor(floors, 'outdoor')?.id).toBe('outdoor');
    expect(openFloor(floors, 'rooftop')?.id).toBe('ground');
    expect(openFloor(floors, null)?.id).toBe('ground');
    expect(openFloor([], null)).toBeUndefined();
  });

  it('says how long guests have been seated', () => {
    expect(seatedFor(0)).toEqual({ key: 'now' });
    expect(seatedFor(26)).toEqual({ key: 'minutes', count: 26 });
    expect(seatedFor(65)).toEqual({ key: 'hours', hours: 1, minutes: 5 });
  });

  it("builds a table's page and an area's address", () => {
    expect(tablePath(5)).toBe('/admin/dashboard/tables/view/?table=5');
    expect(floorPath('first floor')).toBe('/admin/dashboard/tables/?floor=first%20floor');
  });
});
