import { describe, expect, it } from 'vitest';
import { countOf, countTotal, denominationsOf, differenceKind } from '@/lib/cashRegister';

/* Counting the drawer: notes and coins by currency, and what a difference means. */

describe('cash register', () => {
  it('counts notes and coins in the branch currency', () => {
    const inr = denominationsOf('INR');
    expect(inr[0]).toBe(500);
    expect(denominationsOf('NPR')[0]).toBe(1000);
    expect(denominationsOf('USD')).toEqual([]);
    const state = { '500': '4', '100': '3', '10': '', '2': 'x', '1': '7' };
    expect(countTotal(inr, state)).toBe(2307);
    expect(countOf(inr, state)).toEqual([
      { value: 500, quantity: 4 },
      { value: 100, quantity: 3 },
      { value: 1, quantity: 7 },
    ]);
  });

  it('reads a difference as matching, short or over', () => {
    expect(differenceKind(0)).toBe('match');
    expect(differenceKind(-10)).toBe('short');
    expect(differenceKind(5)).toBe('over');
  });
});
