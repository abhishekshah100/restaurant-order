import { describe, expect, it } from 'vitest';
import {
  PASS_STATION,
  allDishesDone,
  itemDone,
  stationDishesLeft,
  stationItems,
  stationProgress,
  type CategoryOf,
} from '@/lib/kitchenBoard';
import {
  OUTBOX_MAX_AGE_MS,
  enqueue,
  parseOutbox,
  splitExpired,
  withOutbox,
  type OutboxEntry,
} from '@/lib/kitchenOutbox';
import type { Order, OrderItem, OrderRound } from '@/types/order';

/*
 * The kitchen's taps waiting to be sent (lib/kitchenOutbox) and the stations' progress on a
 * ticket (lib/kitchenBoard): what's queued, what's too old, how the board shows them, and when
 * a station or the whole ticket is done.
 */

const item = (dishSlug: string, over: Partial<OrderItem> = {}): OrderItem => ({
  dishSlug,
  name: dishSlug,
  veg: true,
  quantity: 1,
  details: [],
  unitPrice: 100,
  ...over,
});

const round = (number: number, items: OrderItem[]): OrderRound => ({
  number,
  placedAt: '2026-11-17T12:00:00Z',
  status: 'received',
  items,
  timeline: [{ status: 'received', time: '', at: '2026-11-17T12:00:00Z' }],
  changeableUntil: '2026-11-17T12:00:00Z',
});

const order = (id: string, rounds: OrderRound[]): Order => ({
  id,
  branchId: 'b1',
  mode: 'dineIn',
  table: 4,
  customerName: 'Guest',
  placedBy: 'other',
  sessionId: 's1',
  placedAt: rounds[0].placedAt,
  status: 'received',
  items: rounds.flatMap((r) => r.items),
  itemTotal: 0,
  total: 0,
  payment: { method: 'counter', status: 'unpaid' },
  timeline: rounds[0].timeline,
  rounds,
});

let n = 0;
const step = (over: Partial<OutboxEntry> & { step?: 'received' | 'preparing' | 'ready' } = {}) =>
  ({
    id: `s${(n += 1)}`,
    at: 1_000,
    branchId: 'b1',
    orderId: 'A1',
    round: 1,
    tries: 0,
    kind: 'step',
    step: 'preparing',
    ...over,
  }) as OutboxEntry;
const tick = (index: number, plated: boolean, over: Partial<OutboxEntry> = {}) =>
  ({
    id: `p${(n += 1)}`,
    at: 1_000,
    branchId: 'b1',
    orderId: 'A1',
    round: 1,
    tries: 0,
    kind: 'plated',
    index,
    plated,
    ...over,
  }) as OutboxEntry;

describe('kitchen outbox', () => {
  it('queues steps in order, and keeps only the last tick of a dish', () => {
    let queue = enqueue([], step({ step: 'preparing' }));
    queue = enqueue(queue, tick(0, true));
    queue = enqueue(queue, step({ step: 'ready' }));
    queue = enqueue(queue, tick(0, false));
    queue = enqueue(queue, tick(1, true));
    expect(queue.map((e) => (e.kind === 'step' ? e.step : `${e.index}:${e.plated}`))).toEqual([
      'preparing',
      'ready',
      '0:false',
      '1:true',
    ]);
  });

  it('drops taps over two hours old', () => {
    const fresh = step({ at: 10_000_000 });
    const old = step({ at: 10_000_000 - OUTBOX_MAX_AGE_MS - 1 });
    const { kept, expired } = splitExpired([old, fresh], 10_000_000);
    expect(kept).toEqual([fresh]);
    expect(expired).toEqual([old]);
  });

  it("shows the branch's taps on its orders, in the order they were made", () => {
    const orders = [order('A1', [round(1, [item('naan'), item('curry')])])];
    const shown = withOutbox(
      orders,
      [
        step({ step: 'preparing' }),
        tick(1, true),
        step({ step: 'ready' }),
        step({ step: 'preparing', branchId: 'b2' }),
      ],
      'b1',
    );
    expect(shown[0].rounds?.[0].status).toBe('ready');
    expect(shown[0].rounds?.[0].items.map((i) => i.plated)).toEqual([undefined, true]);
    // The server's orders are left as they were.
    expect(orders[0].rounds?.[0].status).toBe('received');
  });

  it('reads back only well-formed taps', () => {
    const good = step();
    expect(parseOutbox([good, { kind: 'step', step: 'cook' }, null, 3])).toEqual([good]);
    expect(parseOutbox('nope')).toEqual([]);
  });
});

describe('stations and the pass', () => {
  const CATEGORY: Record<string, string> = { naan: 'breads', kebab: 'tandoor', curry: 'mains' };
  const categoryOf: CategoryOf = (slug) => CATEGORY[slug];
  const ticket = {
    items: [
      item('naan', { plated: true }),
      item('kebab'),
      item('curry', { quantity: 2, unavailable: 2 }),
      item('naan'),
    ],
  };

  it('counts a dish done once plated, or when none of it is left to make', () => {
    expect(ticket.items.map(itemDone)).toEqual([true, false, true, false]);
  });

  it("gives each station's progress, in the order they first appear", () => {
    expect(stationProgress(ticket, categoryOf)).toEqual([
      { station: 'breads', done: 1, total: 2 },
      { station: 'tandoor', done: 0, total: 1 },
      { station: 'mains', done: 1, total: 1 },
    ]);
  });

  it("finds a station's dishes still to finish, by their place on the ticket", () => {
    expect(stationDishesLeft(ticket, 'breads', categoryOf)).toEqual([3]);
    expect(stationDishesLeft(ticket, 'mains', categoryOf)).toEqual([]);
  });

  it('is all done only when every dish is', () => {
    expect(allDishesDone(ticket)).toBe(false);
    expect(allDishesDone({ items: ticket.items.map((i) => ({ ...i, plated: true })) })).toBe(true);
    expect(allDishesDone({ items: [] })).toBe(false);
  });

  it('shows the pass every dish', () => {
    expect(stationItems(ticket, PASS_STATION, categoryOf)).toHaveLength(4);
  });
});
