import { describe, expect, it } from 'vitest';
import { biggestProblem, change, countStreak } from '@/lib/inventoryWeek';
import type { UsageResponse } from '@/types/inventory';

/* The inventory week: against last week, the biggest problem, counting streak. */

describe('the week', () => {
  it('compares with last week in whole percent', () => {
    expect(change(800, 1000)).toBe(-20);
    expect(change(1250, 1000)).toBe(25);
    expect(change(500, 0)).toBeUndefined();
  });

  it('finds what cost most, wasted or missing', () => {
    const row = (name: string, wastage: number, unexplained: number) => ({
      name,
      value: { wastage, unexplained },
    });
    const usage = {
      rows: [row('Milk', 420, 0), row('Butter', 0, 600), row('Rice', 100, -300)],
    } as unknown as UsageResponse;
    expect(biggestProblem(usage)).toEqual({ name: 'Butter', kind: 'missing', value: 600 });
    expect(
      biggestProblem({ rows: [row('Salt', 0, -10)] } as unknown as UsageResponse),
    ).toBeUndefined();
  });

  it('counts weeks in a row with a count, this week or up to last', () => {
    const now = new Date('2026-11-13T12:00:00.000Z');
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
    expect(countStreak([daysAgo(1), daysAgo(8), daysAgo(15), daysAgo(29)], now)).toBe(3);
    // Nothing this week yet: the run up to last week still counts.
    expect(countStreak([daysAgo(9), daysAgo(16)], now)).toBe(2);
    expect(countStreak([daysAgo(20)], now)).toBe(0);
    expect(countStreak([], now)).toBe(0);
  });
});
