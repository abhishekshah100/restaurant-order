import { describe, expect, it } from 'vitest';
import { attention, fullness, sameName, setupState } from '@/lib/inventorySetup';
import type { InventoryDashboard, RecipeSummary, StockItem, StockSummary } from '@/types/inventory';

/* Inventory made easy: the Get started steps, what needs someone today, how full an item is. */

const item = (name: string, extra: Partial<StockItem> = {}): StockItem => ({
  ingredientId: name,
  name,
  categoryId: null,
  unit: 'kg',
  onHand: 5,
  reorderLevel: 0,
  parLevel: 0,
  status: 'ok',
  openingDue: false,
  ...extra,
});
const dish = (lines: number) => ({ slug: `d${lines}`, lines }) as unknown as RecipeSummary;
const none = new Set<never>();

describe('Get started', () => {
  it('starts at adding ingredients, then what you have now, and is the first screen until both', () => {
    const empty = setupState([], [dish(0)], none);
    expect(empty).toMatchObject({ current: 'ingredients', needed: true, finished: 0 });

    const added = setupState(
      [item('Onion', { openingDue: true }), item('Paneer', { openingDue: true })],
      [],
      none,
    );
    expect(added.steps).toMatchObject({ ingredients: 'done', opening: 'todo' });
    expect(added).toMatchObject({ current: 'opening', needed: true, openingDue: 2 });

    // Stock has started: one new item without an amount is Today's job, not the guide's.
    const oneNew = setupState([item('Onion', { openingDue: true }), item('Paneer')], [], none);
    expect(oneNew).toMatchObject({ current: 'opening', needed: false, openingDue: 1 });

    const stocked = setupState([item('Onion'), item('Paneer')], [dish(0), dish(0)], none);
    expect(stocked).toMatchObject({ current: 'levels', needed: false, finished: 2, dishes: 2 });
  });

  it('marks levels done when every item has one, recipes when any dish has one, or either skipped', () => {
    const items = [item('Onion', { reorderLevel: 5 }), item('Paneer', { reorderLevel: 2 })];
    expect(setupState(items, [dish(2), dish(0)], none)).toMatchObject({
      current: null,
      finished: 4,
      withLevel: 2,
      withRecipe: 1,
    });
    const skipped = setupState([item('Onion')], [dish(0)], new Set(['levels', 'recipes'] as const));
    expect(skipped.steps).toMatchObject({ levels: 'skipped', recipes: 'skipped' });
    expect(skipped).toMatchObject({ current: null, finished: 4 });
    expect(sameName('  Paneer ', 'paneer')).toBe(true);
  });
});

describe('Today: what needs someone', () => {
  const summary = (extra: Partial<StockSummary> = {}): StockSummary => ({
    tracked: 10,
    low: 0,
    out: 0,
    expiring: 0,
    expired: 0,
    ...extra,
  });
  const board = (extra: Partial<InventoryDashboard> = {}) =>
    ({
      todo: {
        countsToApply: 0,
        transfersToReceive: 0,
        expiring: 0,
        expired: 0,
        pricesToConfirm: 0,
        ordersToApprove: 0,
        deliveriesDue: 0,
      },
      lastCount: { number: 1, at: '2026-11-10T10:00:00.000Z' },
      ...extra,
    }) as InventoryDashboard;
  const now = new Date('2026-11-13T10:00:00.000Z');

  it('lists out and expired first, then low, starting stock, use-first and purchasing', () => {
    const list = attention(
      summary({ out: 2, low: 3, expired: 1, expiredValue: 120, expiring: 4 }),
      1,
      board({ todo: { ...board().todo, deliveriesDue: 1, pricesToConfirm: 2 } }),
      now,
      true,
    );
    expect(list.map((a) => [a.id, a.tone, a.count])).toEqual([
      ['out', 'urgent', 2],
      ['expired', 'urgent', 1],
      ['low', 'soon', 3],
      ['opening', 'soon', 1],
      ['expiring', 'soon', 4],
      ['deliveriesDue', 'soon', 1],
      ['pricesToConfirm', 'info', 2],
    ]);
    expect(list[1]?.value).toBe(120);
    // Without purchasing rights its items stay off.
    expect(
      attention(summary(), 0, board({ todo: { ...board().todo, deliveriesDue: 1 } }), now, false),
    ).toEqual([]);
  });

  it('asks for a stock count a week after the last, never right after setup', () => {
    // Never counted: entering what you have was the first count; nothing asked.
    expect(attention(summary(), 0, board({ lastCount: undefined }), now, false)).toEqual([]);
    const old = board({ lastCount: { number: 3, at: '2026-11-03T09:00:00.000Z' } });
    expect(attention(summary(), 0, old, now, false)).toEqual([
      { id: 'countDue', tone: 'info', count: 1, days: 10 },
    ]);
    expect(attention(summary({ tracked: 0 }), 0, old, now, false)).toEqual([]);
  });
});

describe('how full an item is', () => {
  it('measures against a full shelf, else twice the order level, else nothing', () => {
    expect(fullness({ onHand: 6, reorderLevel: 2, parLevel: 12 })).toBe(0.5);
    expect(fullness({ onHand: 2, reorderLevel: 2, parLevel: 0 })).toBe(0.5);
    expect(fullness({ onHand: 30, reorderLevel: 2, parLevel: 0 })).toBe(1);
    expect(fullness({ onHand: -1, reorderLevel: 2, parLevel: 0 })).toBe(0);
    expect(fullness({ onHand: 5, reorderLevel: 0, parLevel: 0 })).toBeUndefined();
  });
});

describe('running out soon', () => {
  it('warns about items that will run out within days, after the low ones', () => {
    const list = attention(
      { tracked: 5, low: 1, out: 0, expiring: 0, expired: 0 },
      0,
      undefined,
      new Date('2026-11-13T10:00:00.000Z'),
      false,
      2,
    );
    expect(list.map((a) => [a.id, a.count])).toEqual([
      ['low', 1],
      ['runningOut', 2],
    ]);
  });
});

describe('prices up', () => {
  it('warns of prices that rose, urgent when a dish is now over the food cost goal', () => {
    const rise = (name: string, dishes: [string, number][]) => ({
      ingredientId: name,
      name,
      unit: 'kg' as const,
      from: 400,
      to: 480,
      change: 20,
      dishes: dishes.map(([slug, foodCostTo]) => ({
        slug,
        name: slug,
        costFrom: 60,
        costTo: 72,
        foodCostTo,
      })),
    });
    const board = (rises: ReturnType<typeof rise>[]) =>
      ({ todo: undefined, priceRises: rises, foodCostTarget: 35 }) as unknown as Parameters<
        typeof attention
      >[2];
    const summary = { tracked: 2, low: 0, out: 0, expiring: 0, expired: 0 };
    const now = new Date('2026-11-13T10:00:00.000Z');
    // Two sizes of one dish count once.
    expect(
      attention(
        summary,
        0,
        board([
          rise('Paneer', [
            ['tikka', 28],
            ['tikka', 30],
          ]),
        ]),
        now,
        false,
      ),
    ).toEqual([{ id: 'priceUp', tone: 'soon', count: 1, dishes: 1, overGoal: 0 }]);
    expect(
      attention(
        summary,
        0,
        board([
          rise('Paneer', [['tikka', 36]]),
          rise('Onion', [
            ['dal', 20],
            ['tikka', 40],
          ]),
        ]),
        now,
        false,
      ),
    ).toEqual([{ id: 'priceUp', tone: 'urgent', count: 2, dishes: 2, overGoal: 1 }]);
  });
});
