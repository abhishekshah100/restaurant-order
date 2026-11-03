import { describe, expect, it } from 'vitest';
import {
  canAddPart,
  nextMethod,
  partsRequest,
  restOf,
  rowAmount,
  takesProof,
  type PartRow,
} from '@/lib/paymentParts';

/* A bill paid in more than one way: the rows, the rest, and the request. */

const row = (id: string, method: PartRow['method'], amount = ''): PartRow => ({
  id,
  method,
  amount,
});

describe('paying in parts', () => {
  it('reads typed amounts: more than nothing, two decimals at most', () => {
    expect(rowAmount('1500')).toBe(1500);
    expect(rowAmount(' 1,500.5 ')).toBe(1500.5);
    expect(rowAmount('0')).toBeNull();
    expect(rowAmount('12.345')).toBeNull();
    expect(rowAmount('abc')).toBeNull();
  });

  it('leaves the rest for the last way, exactly in paise', () => {
    const rows = [row('a', 'cash', '1500'), row('b', 'upi')];
    expect(restOf(rows, 3026, 100)).toBe(1526);
    expect(
      restOf([row('a', 'cash', '0.1'), row('b', 'card', '0.2'), row('c', 'upi')], 1, 100),
    ).toBe(0.7);
    // The others already cover it: nothing left.
    expect(restOf([row('a', 'cash', '3100'), row('b', 'upi')], 3026, 100)).toBe(-74);
  });

  it('adds UPI next when it can, else a way not used yet, up to five', () => {
    expect(nextMethod(['card', 'upi', 'cash'], [row('a', 'cash')])).toBe('upi');
    expect(nextMethod(['card', 'upi', 'cash'], [row('a', 'upi')])).toBe('card');
    expect(nextMethod(['esewa', 'khalti', 'cash'], [row('a', 'cash')])).toBe('esewa');
    expect(nextMethod(['cash'], [row('a', 'cash')])).toBe('cash');
    expect(canAddPart([row('a', 'cash'), row('b', 'upi')])).toBe(true);
    expect(canAddPart(['a', 'b', 'c', 'd', 'e'].map((id) => row(id, 'cash')))).toBe(false);
  });

  it('sends each way with its photos, never photos of cash', () => {
    const rows = [row('a', 'cash', '1500'), row('b', 'upi', '1526')];
    const keys = (id: string) => (id === 'b' ? ['k1.jpg'] : ['stray.jpg']);
    expect(partsRequest(rows, keys)).toEqual([
      { method: 'cash', amount: 1500 },
      { method: 'upi', amount: 1526, proofs: ['k1.jpg'] },
    ]);
    expect(takesProof('cash')).toBe(false);
    expect(takesProof('upi')).toBe(true);
  });
});
