/*
 * Master values for units of measurement: how a dish or a stock item is counted (a piece, a
 * plate, a glass) or measured (ml, litre, g, kg). Measured units convert to their dimension's
 * base unit. Words: common › masters.units (name and short form).
 */

export const UNIT_DIMENSIONS = ['count', 'volume', 'weight'] as const;
export type UnitDimension = (typeof UNIT_DIMENSIONS)[number];

export interface UnitMaster {
  dimension: UnitDimension;
  /** How many of the dimension's base unit (ml, g; a count is 1) one of this is. */
  toBase: number;
}

export const UNITS = {
  piece: { dimension: 'count', toBase: 1 },
  plate: { dimension: 'count', toBase: 1 },
  bowl: { dimension: 'count', toBase: 1 },
  glass: { dimension: 'count', toBase: 1 },
  bottle: { dimension: 'count', toBase: 1 },
  ml: { dimension: 'volume', toBase: 1 },
  litre: { dimension: 'volume', toBase: 1000 },
  g: { dimension: 'weight', toBase: 1 },
  kg: { dimension: 'weight', toBase: 1000 },
} as const satisfies Record<string, UnitMaster>;
export type UnitCode = keyof typeof UNITS;
export const UNIT_CODES = Object.keys(UNITS) as UnitCode[];

/**
 * An amount in another unit of the same dimension (1.5 litre → 1500 ml); null across
 * dimensions or between count units (a plate isn't a number of pieces).
 */
export function convertUnit(amount: number, from: UnitCode, to: UnitCode): number | null {
  const a = UNITS[from];
  const b = UNITS[to];
  if (a.dimension !== b.dimension) return null;
  if (a.dimension === 'count') return from === to ? amount : null;
  return (amount * a.toBase) / b.toBase;
}
