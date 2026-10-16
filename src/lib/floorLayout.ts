import type { FloorLayout, FloorPlanLayout, FloorTableLayout } from '@/types/admin';

/*
 * The floor plan editor's rules, pure: a branch's areas and their tables in the floors.json
 * shape (GET/PATCH /admin/branches/:branchId/floors). Adding, renaming, moving and removing areas
 * and tables, and taking tables out of service; the next free table numbers; what's wrong with a layout before it's saved. The
 * mock server checks a layout with the same function.
 */

/** Table numbers go from 1 to this (a QR link carries up to four digits). */
export const MAX_TABLE_NUMBER = 9999;
/** The most seats one table has. */
export const MAX_SEATS = 50;
/** The most tables added in one go. */
export const MAX_TABLES_AT_ONCE = 50;
/** The longest area name. */
export const MAX_AREA_NAME = 40;

const allTables = (layout: FloorPlanLayout): FloorTableLayout[] =>
  layout.floors.flatMap((f) => f.tables);

/** Areas, tables and seats in the layout. */
export function layoutTotals(layout: FloorPlanLayout) {
  const tables = allTables(layout);
  return {
    areas: layout.floors.length,
    tables: tables.length,
    seats: tables.reduce((sum, t) => sum + t.seats, 0),
    outOfService: tables.filter((t) => t.disabled).length,
  };
}

export const floorSeats = (floor: FloorLayout) => floor.tables.reduce((s, t) => s + t.seats, 0);

/** Every table number in use. */
export const usedNumbers = (layout: FloorPlanLayout): Set<number> =>
  new Set(allTables(layout).map((t) => t.number));

/**
 * `count` free table numbers in a row, starting after the highest one in use (1 on an empty
 * plan): what a new table, or a batch of them, is numbered by default.
 */
export function nextNumbers(layout: FloorPlanLayout, count = 1): number[] {
  const highest = Math.max(0, ...usedNumbers(layout));
  return Array.from({ length: count }, (_, i) => highest + 1 + i);
}

/** Numbers from `start` for `count` tables, and which of them are already taken. */
export function numberRun(layout: FloorPlanLayout, start: number, count: number) {
  const used = usedNumbers(layout);
  const numbers = Array.from({ length: count }, (_, i) => start + i);
  return { numbers, taken: numbers.filter((n) => used.has(n)) };
}

/** An id for a new area, from its name ("Roof terrace" → "roof-terrace"), not already used. */
export function newAreaId(layout: FloorPlanLayout, name: string): string {
  const base =
    name
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'area';
  const ids = new Set(layout.floors.map((f) => f.id));
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
  return id;
}

/* ---------- Edits (each returns a new layout) ---------- */

export function addArea(layout: FloorPlanLayout, name: string): FloorPlanLayout {
  const floor: FloorLayout = { id: newAreaId(layout, name), name: name.trim(), tables: [] };
  return { floors: [...layout.floors, floor] };
}

export function renameArea(layout: FloorPlanLayout, id: string, name: string): FloorPlanLayout {
  return { floors: layout.floors.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)) };
}

/** Moves an area one place up (-1) or down (+1) in the order staff walk them. */
export function moveArea(layout: FloorPlanLayout, id: string, by: -1 | 1): FloorPlanLayout {
  const index = layout.floors.findIndex((f) => f.id === id);
  const to = index + by;
  if (index < 0 || to < 0 || to >= layout.floors.length) return layout;
  const floors = [...layout.floors];
  [floors[index], floors[to]] = [floors[to], floors[index]];
  return { floors };
}

/** Removes an area and every table in it. */
export const removeArea = (layout: FloorPlanLayout, id: string): FloorPlanLayout => ({
  floors: layout.floors.filter((f) => f.id !== id),
});

const byNumber = (a: FloorTableLayout, b: FloorTableLayout) => a.number - b.number;

/** Adds tables to an area (in number order), each with `seats`. */
export function addTables(
  layout: FloorPlanLayout,
  areaId: string,
  numbers: readonly number[],
  seats: number,
): FloorPlanLayout {
  const added = numbers.map((number) => ({ number, seats, freed: false }));
  return {
    floors: layout.floors.map((f) =>
      f.id === areaId ? { ...f, tables: [...f.tables, ...added].sort(byNumber) } : f,
    ),
  };
}

/**
 * Changes one table: its number, its seats, the area it's in, and whether it's in service. Its
 * place follows its number; the freed flag goes with it.
 */
export function updateTable(
  layout: FloorPlanLayout,
  number: number,
  next: { number: number; seats: number; areaId: string; disabled?: boolean },
): FloorPlanLayout {
  const current = allTables(layout).find((t) => t.number === number);
  if (!current) return layout;
  const { disabled: _was, ...rest } = current;
  const disabled = next.disabled ?? current.disabled;
  const table: FloorTableLayout = {
    ...rest,
    number: next.number,
    seats: next.seats,
    ...(disabled ? { disabled: true } : {}),
  };
  return {
    floors: layout.floors.map((f) => {
      const tables = f.tables.filter((t) => t.number !== number);
      return f.id === next.areaId
        ? { ...f, tables: [...tables, table].sort(byNumber) }
        : { ...f, tables };
    }),
  };
}

export const removeTable = (layout: FloorPlanLayout, number: number): FloorPlanLayout => ({
  floors: layout.floors.map((f) => ({ ...f, tables: f.tables.filter((t) => t.number !== number) })),
});

/** The area a table is in. */
export const areaOf = (layout: FloorPlanLayout, number: number) =>
  layout.floors.find((f) => f.tables.some((t) => t.number === number));

/* ---------- Checks ---------- */

export const isTableNumber = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_TABLE_NUMBER;
export const isSeatCount = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_SEATS;

/** A name nobody else uses (in any case), if it's a name at all. */
export function areaNameError(
  layout: FloorPlanLayout,
  name: string,
  exceptId?: string,
): 'empty' | 'long' | 'taken' | null {
  const clean = name.trim();
  if (!clean) return 'empty';
  if (clean.length > MAX_AREA_NAME) return 'long';
  const lower = clean.toLocaleLowerCase();
  return layout.floors.some((f) => f.id !== exceptId && f.name.toLocaleLowerCase() === lower)
    ? 'taken'
    : null;
}

/** What's wrong with a layout as a whole. */
export type LayoutError =
  'noAreas' | 'noTables' | 'areaName' | 'areaId' | 'tableNumber' | 'duplicateNumber' | 'seats';

/**
 * What stops a layout being saved, if anything: at least one area with at least one table in
 * all; areas with ids and names of their own; table numbers 1–9999 used once; 1–50 seats.
 */
export function layoutErrors(layout: FloorPlanLayout): LayoutError[] {
  const errors = new Set<LayoutError>();
  if (layout.floors.length === 0) errors.add('noAreas');
  if (allTables(layout).length === 0) errors.add('noTables');
  const ids = new Set<string>();
  const names = new Set<string>();
  const numbers = new Set<number>();
  for (const floor of layout.floors) {
    if (!floor.id || ids.has(floor.id)) errors.add('areaId');
    ids.add(floor.id);
    const name = floor.name.trim().toLocaleLowerCase();
    if (!name || floor.name.trim().length > MAX_AREA_NAME || names.has(name)) {
      errors.add('areaName');
    }
    names.add(name);
    for (const table of floor.tables) {
      if (!isTableNumber(table.number)) errors.add('tableNumber');
      if (numbers.has(table.number)) errors.add('duplicateNumber');
      numbers.add(table.number);
      if (!isSeatCount(table.seats)) errors.add('seats');
    }
  }
  return [...errors];
}

/** Table numbers in `before` that `after` no longer has (removed, or renumbered away). */
export function removedNumbers(before: FloorPlanLayout, after: FloorPlanLayout): number[] {
  const kept = usedNumbers(after);
  return [...usedNumbers(before)].filter((n) => !kept.has(n)).sort((a, b) => a - b);
}

/** Table numbers `after` takes out of service that were in service in `before`. */
export function disabledNumbers(before: FloorPlanLayout, after: FloorPlanLayout): number[] {
  const wasOff = new Set(
    allTables(before)
      .filter((t) => t.disabled)
      .map((t) => t.number),
  );
  const had = usedNumbers(before);
  return allTables(after)
    .filter((t) => t.disabled && had.has(t.number) && !wasOff.has(t.number))
    .map((t) => t.number)
    .sort((a, b) => a - b);
}

/** The same layout (areas, their order and names, tables, seats and service)? */
export const sameLayout = (a: FloorPlanLayout, b: FloorPlanLayout) =>
  JSON.stringify(normalised(a)) === JSON.stringify(normalised(b));

const normalised = (layout: FloorPlanLayout) =>
  layout.floors.map((f) => [
    f.id,
    f.name,
    f.tables.map((t) => [t.number, t.seats, t.disabled === true]),
  ]);

/** A layout as sent to the server: names trimmed, tables in number order. */
export const cleanLayout = (layout: FloorPlanLayout): FloorPlanLayout => ({
  floors: layout.floors.map((f) => ({
    id: f.id,
    name: f.name.trim(),
    tables: [...f.tables].sort(byNumber).map((t) => ({
      number: t.number,
      seats: t.seats,
      freed: t.freed,
      ...(t.disabled ? { disabled: true } : {}),
    })),
  })),
});

/** Whether a table on the plan is out of service. */
export const isOutOfService = (layout: FloorPlanLayout, number: number) =>
  allTables(layout).some((t) => t.number === number && t.disabled === true);
