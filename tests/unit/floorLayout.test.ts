import { describe, expect, it } from 'vitest';
import { settingsPath, tablePath } from '@/lib/adminNav';
import { activeSettingsSection } from '@/lib/adminSettings';
import {
  addArea,
  addTables,
  areaNameError,
  cleanLayout,
  disabledNumbers,
  isOutOfService,
  layoutErrors,
  layoutTotals,
  moveArea,
  newAreaId,
  nextNumbers,
  numberRun,
  removeArea,
  removeTable,
  removedNumbers,
  renameArea,
  sameLayout,
  updateTable,
} from '@/lib/floorLayout';
import type { FloorPlanLayout } from '@/types/admin';

/* Settings › Floor plan: editing areas and tables in the floors.json shape, and its checks. */

const table = (number: number, seats = 4) => ({ number, seats, freed: false });
const plan: FloorPlanLayout = {
  floors: [
    { id: 'ground', name: 'Ground floor', tables: [table(1, 2), table(2), table(3, 6)] },
    { id: 'terrace', name: 'Terrace', tables: [table(10)] },
  ],
};
const numbersIn = (layout: FloorPlanLayout, id: string) =>
  layout.floors.find((f) => f.id === id)?.tables.map((t) => t.number);

describe('the floor plan', () => {
  it('counts areas, tables and seats, and numbers new tables after the highest', () => {
    expect(layoutTotals(plan)).toEqual({ areas: 2, tables: 4, seats: 16, outOfService: 0 });
    expect(nextNumbers(plan, 3)).toEqual([11, 12, 13]);
    expect(nextNumbers({ floors: [] })).toEqual([1]);
    expect(numberRun(plan, 9, 3)).toEqual({ numbers: [9, 10, 11], taken: [10] });
  });

  it('adds, renames, moves and removes areas', () => {
    const added = addArea(plan, '  Roof terrace ');
    expect(added.floors.at(-1)).toEqual({ id: 'roof-terrace', name: 'Roof terrace', tables: [] });
    // Terrace and terrace-2 are taken.
    expect(newAreaId(addArea(plan, 'Terrace 2'), 'Terrace!')).toBe('terrace-3');
    expect(newAreaId(plan, '★')).toBe('area');
    expect(renameArea(plan, 'terrace', 'Garden').floors[1].name).toBe('Garden');
    expect(moveArea(plan, 'terrace', -1).floors.map((f) => f.id)).toEqual(['terrace', 'ground']);
    expect(moveArea(plan, 'ground', -1)).toBe(plan);
    expect(removeArea(plan, 'terrace').floors.map((f) => f.id)).toEqual(['ground']);
  });

  it('adds tables in number order, changes and moves one, and removes one', () => {
    expect(numbersIn(addTables(plan, 'ground', [5, 4], 2), 'ground')).toEqual([1, 2, 3, 4, 5]);
    const moved = updateTable(plan, 3, { number: 12, seats: 8, areaId: 'terrace' });
    expect(numbersIn(moved, 'ground')).toEqual([1, 2]);
    expect(moved.floors[1].tables).toEqual([table(10), table(12, 8)]);
    expect(numbersIn(removeTable(plan, 2), 'ground')).toEqual([1, 3]);
    expect(removedNumbers(plan, moved)).toEqual([3]);
  });

  it('checks area names: given, short enough and their own', () => {
    expect(areaNameError(plan, ' ')).toBe('empty');
    expect(areaNameError(plan, 'x'.repeat(41))).toBe('long');
    expect(areaNameError(plan, 'terrace')).toBe('taken');
    expect(areaNameError(plan, 'Terrace', 'terrace')).toBeNull();
    expect(areaNameError(plan, 'Bar')).toBeNull();
  });

  it('says what stops a layout being saved', () => {
    expect(layoutErrors(plan)).toEqual([]);
    expect(layoutErrors({ floors: [] })).toEqual(['noAreas', 'noTables']);
    expect(layoutErrors({ floors: [{ id: 'a', name: 'A', tables: [] }] })).toEqual(['noTables']);
    const broken: FloorPlanLayout = {
      floors: [
        { id: 'a', name: 'Same', tables: [table(1), table(0)] },
        { id: 'a', name: 'same', tables: [table(1, 0)] },
      ],
    };
    expect(layoutErrors(broken).sort()).toEqual(
      ['areaId', 'areaName', 'duplicateNumber', 'seats', 'tableNumber'].sort(),
    );
  });

  it('compares layouts and cleans one to send', () => {
    expect(sameLayout(plan, cleanLayout(plan))).toBe(true);
    expect(sameLayout(plan, renameArea(plan, 'ground', 'Downstairs'))).toBe(false);
    const messy = { floors: [{ id: 'a', name: ' A ', tables: [table(3), table(1)] }] };
    expect(cleanLayout(messy)).toEqual({
      floors: [{ id: 'a', name: 'A', tables: [table(1), table(3)] }],
    });
  });

  it('takes a table out of service and back, keeping it on the plan', () => {
    const off = updateTable(plan, 2, { number: 2, seats: 4, areaId: 'ground', disabled: true });
    expect(off.floors[0].tables[1]).toEqual({ number: 2, seats: 4, freed: false, disabled: true });
    expect(isOutOfService(off, 2)).toBe(true);
    expect(layoutTotals(off)).toMatchObject({ tables: 4, outOfService: 1 });
    expect(disabledNumbers(plan, off)).toEqual([2]);
    expect(sameLayout(plan, off)).toBe(false);
    expect(cleanLayout(off).floors[0].tables[1].disabled).toBe(true);
    // Back in service: the flag goes, and nothing was newly disabled.
    const on = updateTable(off, 2, { number: 2, seats: 4, areaId: 'ground', disabled: false });
    expect(on.floors[0].tables[1]).toEqual(table(2));
    expect(disabledNumbers(off, on)).toEqual([]);
    // A table added out of service isn't "taken out" of service.
    expect(disabledNumbers({ floors: [] }, off)).toEqual([]);
  });

  it('links one page for every table, and the settings pages', () => {
    expect(tablePath(5)).toBe('/admin/dashboard/tables/view/?table=5');
    expect(settingsPath('floor-plan')).toBe('/admin/dashboard/settings/floor-plan/');
    expect(activeSettingsSection('/admin/dashboard/settings/floor-plan')).toBe('floorPlan');
    expect(activeSettingsSection('/admin/dashboard/settings/')).toBeUndefined();
  });
});
