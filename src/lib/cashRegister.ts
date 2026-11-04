import type { CashMovementReason, DrawerCount } from '@/api/contracts';
import type { Price } from '@/types/menu';

/*
 * The cash register's arithmetic: the notes and coins a drawer is counted in (by currency), what
 * a count comes to, and how a closing difference reads. The server keeps the sums; this only
 * helps staff count.
 */

/** Notes and coins in circulation, largest first. Unknown currencies count a total only. */
const DENOMINATIONS: Readonly<Record<string, readonly number[]>> = {
  INR: [500, 200, 100, 50, 20, 10, 5, 2, 1],
  NPR: [1000, 500, 100, 50, 20, 10, 5, 2, 1],
};

export const denominationsOf = (currency: string): readonly number[] =>
  DENOMINATIONS[currency] ?? [];

/** How many of each note or coin were counted, by value ("500" → 4), as typed. */
export type CountState = Readonly<Record<string, string>>;

const quantity = (text: string | undefined) => {
  const n = Number(text ?? '');
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/** What the notes and coins come to. */
export const countTotal = (values: readonly number[], state: CountState): Price =>
  values.reduce((sum, v) => sum + v * quantity(state[String(v)]), 0);

/** The count as the server keeps it: only what was counted. */
export const countOf = (values: readonly number[], state: CountState): DrawerCount =>
  values.flatMap((v) => {
    const n = quantity(state[String(v)]);
    return n > 0 ? [{ value: v, quantity: n }] : [];
  });

/** Counted against expected: matching, short (less in the drawer) or over. */
export const differenceKind = (difference: Price): 'match' | 'short' | 'over' =>
  difference === 0 ? 'match' : difference < 0 ? 'short' : 'over';

export const MOVEMENT_REASONS: Readonly<Record<'in' | 'out', readonly CashMovementReason[]>> = {
  in: ['float', 'other'],
  out: ['supplies', 'withdrawal', 'bank', 'other'],
};
