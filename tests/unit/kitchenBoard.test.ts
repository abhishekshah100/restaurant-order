import { describe, expect, it } from 'vitest';
import {
  activitySummary,
  filterEvents,
  hourLabel,
  kitchenEvents,
  localHour,
  ticketsByHour,
  topDishes,
} from '@/lib/kitchenActivity';
import {
  allDay,
  boardStats,
  boardTickets,
  elapsedMinutes,
  isScheduled,
  kitchenStage,
  kitchenTickets,
  justCancelled,
  justChanged,
  laneTickets,
  ticketUrgency,
  withKitchenStep,
  withPlated,
  type CategoryOf,
  type KitchenTicket,
} from '@/lib/kitchenBoard';
import { activeKitchenNavId } from '@/lib/kitchenNav';
import { adminPage } from '@/lib/adminBranches';
import type { Order, OrderItem, OrderRound, OrderStatus } from '@/types/order';
import { testBranch } from '../apiState';

/*
 * The kitchen's logic (lib/kitchenBoard, lib/kitchenActivity): rounds as tickets, their lanes
 * and urgency, the filters, the all-day counts, the optimistic step, and the day's numbers.
 */

const branch = testBranch('blr-indiranagar');
const NOW = new Date('2026-10-14T20:00:00+05:30');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const item = (dishSlug: string, quantity = 1, variant?: string): OrderItem => ({
  dishSlug,
  name: dishSlug,
  veg: true,
  quantity,
  details: [],
  unitPrice: 100,
  ...(variant ? { variant } : {}),
});

function round(
  number: number,
  placed: number,
  status: OrderStatus,
  items: OrderItem[],
): OrderRound {
  return {
    number,
    placedAt: ago(placed),
    status,
    items,
    timeline: [{ status: 'received', time: '', at: ago(placed) }],
    changeableUntil: ago(placed),
  };
}

function order(id: string, rounds: OrderRound[], over: Partial<Order> = {}): Order {
  return {
    id,
    branchId: branch.id,
    mode: 'dineIn',
    table: 4,
    customerName: 'Guest',
    placedBy: 'other',
    sessionId: 's1',
    placedAt: rounds[0].placedAt,
    status: rounds.at(-1)?.status ?? 'received',
    items: rounds.flatMap((r) => r.items),
    itemTotal: 0,
    total: 0,
    payment: { method: 'counter', status: 'unpaid' },
    timeline: rounds[0].timeline,
    rounds,
    ...over,
  };
}

const CATEGORY: Record<string, string> = { naan: 'breads-rice', kebab: 'starters', curry: 'mains' };
const categoryOf: CategoryOf = (slug) => CATEGORY[slug] as ReturnType<CategoryOf>;

describe('kitchen tickets', () => {
  it('makes a ticket of every round, oldest first, in its lane', () => {
    const tickets = kitchenTickets(
      [
        order('A2', [round(1, 5, 'received', [item('naan', 2)])]),
        order('A1', [
          round(1, 30, 'served', [item('kebab')]),
          round(2, 10, 'preparing', [item('curry'), item('naan', 3)]),
        ]),
      ],
      branch,
    );
    expect(tickets.map((t) => [t.key, t.stage, t.roundCount])).toEqual([
      ['A1:1', 'done', 2],
      ['A1:2', 'cooking', 2],
      ['A2:1', 'new', 1],
    ]);
    const lanes = laneTickets(tickets);
    expect(lanes.new.map((t) => t.key)).toEqual(['A2:1']);
    expect(lanes.cooking.map((t) => t.key)).toEqual(['A1:2']);
  });

  it('says who placed it: the guest app, or a waiter (no guest session)', () => {
    const waiter = order('A3', [round(1, 2, 'received', [item('naan')])], { sessionId: undefined });
    waiter.rounds![0].timeline[0].note = 'Taken by Abhishek';
    const [ticket] = kitchenTickets([waiter], branch);
    expect(ticket).toMatchObject({ source: 'staff', takenBy: 'Taken by Abhishek' });
  });

  it('maps statuses to kitchen stages, delivery done once it is with the rider', () => {
    expect(
      ['received', 'preparing', 'ready', 'outForDelivery', 'cancelled'].map((s) =>
        kitchenStage(s as OrderStatus),
      ),
    ).toEqual(['new', 'cooking', 'ready', 'done', 'cancelled']);
  });

  it('is late past its due time and due soon in its last stretch', () => {
    const [nearlyDue, fresh, late] = kitchenTickets(
      [
        order('A1', [round(1, 16, 'preparing', [item('naan')])]),
        order('A2', [round(1, 4, 'received', [item('naan')])]),
        order('A3', [round(1, 25, 'preparing', [item('naan')])]),
      ],
      branch,
    ).sort((a, b) => a.orderId.localeCompare(b.orderId));
    // Dine-in is due 18 minutes after it's ordered.
    expect(ticketUrgency(nearlyDue, NOW)).toBe('soon');
    expect(ticketUrgency(fresh, NOW)).toBe('onTime');
    expect(ticketUrgency(late, NOW)).toBe('late');
    expect(boardStats([nearlyDue, fresh, late], NOW)).toMatchObject({
      late: 1,
      cooking: 2,
      new: 1,
    });
  });

  it('holds a takeaway for a later slot until it is time to start it', () => {
    const takeaway = order('A4', [round(1, 1, 'received', [item('naan')])], {
      mode: 'takeaway',
      table: undefined,
      pickup: { asap: false, at: new Date(NOW.getTime() + 60 * 60_000).toISOString() },
    });
    const [ticket] = kitchenTickets([takeaway], branch);
    expect(ticket.dueAt).toBe(takeaway.pickup?.at);
    expect(isScheduled(ticket, NOW, branch)).toBe(true);
    expect(isScheduled(ticket, new Date(NOW.getTime() + 45 * 60_000), branch)).toBe(false);
  });

  it('filters by type, station and search', () => {
    const tickets = kitchenTickets(
      [
        order('A1', [round(1, 5, 'received', [item('kebab')])]),
        order('A2', [round(1, 5, 'received', [item('naan', 2)])], {
          mode: 'takeaway',
          table: undefined,
          customerName: 'Meera',
        }),
        order('A3', [round(1, 50, 'served', [item('naan')])]),
      ],
      branch,
    );
    const keys = (filters: Parameters<typeof boardTickets>[1]) =>
      boardTickets(tickets, filters, categoryOf).map((t) => t.orderId);
    expect(keys({ mode: 'all', station: 'all', query: '' })).toEqual(['A1', 'A2']);
    expect(keys({ mode: 'takeaway', station: 'all', query: '' })).toEqual(['A2']);
    expect(keys({ mode: 'all', station: 'starters', query: '' })).toEqual(['A1']);
    expect(keys({ mode: 'all', station: 'all', query: 'meera' })).toEqual(['A2']);
    expect(keys({ mode: 'all', station: 'all', query: '4' })).toEqual(['A1']);
  });

  it('adds up what is still to cook by dish and size, station by station', () => {
    const tickets = kitchenTickets(
      [
        order('A1', [round(1, 5, 'received', [item('naan', 2), item('curry')])]),
        order('A2', [round(1, 3, 'preparing', [item('naan', 3), item('kebab', 1, 'Half')])]),
        order('A3', [round(1, 30, 'ready', [item('naan', 9)])]),
      ],
      branch,
    );
    const groups = allDay(tickets, categoryOf, ['starters', 'mains', 'breads-rice']);
    expect(groups.map((g) => [g.categoryId, g.quantity])).toEqual([
      ['starters', 1],
      ['mains', 1],
      ['breads-rice', 5],
    ]);
    expect(groups[2].lines[0]).toMatchObject({ name: 'naan', quantity: 5, tickets: 2 });
    expect(groups[0].lines[0].variant).toBe('Half');
  });

  it('moves a round on in the cache before the server answers', () => {
    const orders = [
      order('A1', [
        round(1, 20, 'preparing', [item('naan')]),
        round(2, 2, 'received', [item('kebab')]),
      ]),
      order('A2', [round(1, 2, 'received', [item('curry')])], {
        mode: 'delivery',
        table: undefined,
      }),
    ];
    const started = withKitchenStep(orders, 'A1', 2, 'preparing');
    expect(started[0].rounds?.map((r) => r.status)).toEqual(['preparing', 'preparing']);
    expect(started[0].status).toBe('preparing');
    const sent = withKitchenStep(orders, 'A2', 1, 'ready');
    expect(sent[1].status).toBe('outForDelivery');
    expect(sent[0]).toBe(orders[0]);
  });

  it('keeps a cancelled ticket where it was for a few minutes, and flags a change', () => {
    const cooking = round(1, 12, 'cancelled', [item('curry')]);
    cooking.timeline = [
      { status: 'received', time: '', at: ago(12) },
      { status: 'preparing', time: '', at: ago(8) },
      { status: 'cancelled', time: '', at: ago(2) },
    ];
    const old = round(1, 30, 'cancelled', [item('kebab')]);
    old.timeline = [
      { status: 'received', time: '', at: ago(30) },
      { status: 'cancelled', time: '', at: ago(20) },
    ];
    const changed = { ...round(1, 6, 'received', [item('naan')]), changedAt: ago(1) };
    const tickets = kitchenTickets(
      [order('A1', [cooking]), order('A2', [old]), order('A3', [changed])],
      branch,
    );
    const filters = { mode: 'all' as const, station: 'all' as const, query: '' };
    // Without the time, a cancelled ticket is gone; with it, a recent one stays in its lane.
    expect(boardTickets(tickets, filters, categoryOf).map((t) => t.key)).toEqual(['A3:1']);
    const shown = boardTickets(tickets, filters, categoryOf, NOW);
    expect(shown.map((t) => t.key)).toEqual(['A1:1', 'A3:1']);
    expect(laneTickets(shown).cooking.map((t) => t.key)).toEqual(['A1:1']);
    const cancelled = tickets.find((t) => t.key === 'A1:1') as KitchenTicket;
    expect(justCancelled(cancelled, NOW)).toBe(true);
    const fresh = tickets.find((t) => t.key === 'A3:1') as KitchenTicket;
    expect(justChanged(fresh, NOW)).toBe(true);
    expect(justChanged(fresh, new Date(NOW.getTime() + 10 * 60_000))).toBe(false);
  });

  it('ticks items off and steps back in the cache before the server answers', () => {
    const orders = [order('A1', [round(1, 5, 'preparing', [item('naan'), item('curry')])])];
    const ticked = withPlated(orders, 'A1', 1, 1, true);
    expect(ticked[0]?.rounds?.[0]?.items.map((i) => i.plated ?? false)).toEqual([false, true]);
    expect(withKitchenStep(orders, 'A1', 1, 'received')[0]?.status).toBe('received');
  });

  it('is due when its slowest dish is done, and puts rush orders first', () => {
    const prepOf = (slug: string) => ({ naan: 6, curry: 25 })[slug] ?? null;
    const [slow] = kitchenTickets(
      [order('A1', [round(1, 5, 'received', [item('naan'), item('curry')])])],
      branch,
      prepOf,
    );
    expect(slow?.dueAt).toBe(new Date(Date.parse(ago(5)) + 25 * 60_000).toISOString());
    // Nothing on the menu says: the usual 18 minutes.
    const [usual] = kitchenTickets(
      [order('A2', [round(1, 5, 'received', [item('kebab')])])],
      branch,
      prepOf,
    );
    expect(usual?.dueAt).toBe(new Date(Date.parse(ago(5)) + 18 * 60_000).toISOString());

    const tickets = kitchenTickets(
      [
        order('A3', [round(1, 9, 'received', [item('naan')])]),
        order('A4', [round(1, 2, 'received', [item('naan')])], { rush: true }),
      ],
      branch,
    );
    expect(laneTickets(tickets).new.map((t) => t.key)).toEqual(['A4:1', 'A3:1']);
  });

  it('counts the minutes a ticket has waited', () => {
    expect(elapsedMinutes(59_000)).toBe(0);
    expect(elapsedMinutes(65_000)).toBe(1);
    expect(elapsedMinutes(3_725_000)).toBe(62);
    expect(elapsedMinutes(-5)).toBe(0);
  });
});

describe('kitchen activity', () => {
  const finished = order('A1', [
    {
      ...round(1, 40, 'served', [item('naan', 2), item('curry')]),
      timeline: [
        { status: 'received', time: '7:20 PM', at: ago(40) },
        { status: 'preparing', time: '7:22 PM', at: ago(38) },
        { status: 'ready', time: '7:35 PM', at: ago(25) },
        { status: 'served', time: '7:38 PM', at: ago(22) },
      ],
      kitchen: { started: { at: ago(38), by: 'Ravi' } },
    },
  ]);
  const slow = order('A2', [
    {
      ...round(1, 60, 'ready', [item('naan')]),
      timeline: [
        { status: 'received', time: '7:00 PM', at: ago(60) },
        { status: 'ready', time: '7:30 PM', at: ago(30) },
      ],
    },
  ]);
  const cancelled = order('A3', [round(1, 10, 'cancelled', [item('kebab')])], {
    status: 'cancelled',
  });
  const tickets = kitchenTickets([finished, slow, cancelled], branch);

  it('counts the day: finished, items, average and longest ticket, on time, cancelled', () => {
    expect(activitySummary(tickets)).toEqual({
      tickets: 2,
      finished: 2,
      itemsCooked: 4,
      averageMinutes: 23,
      longestMinutes: 30,
      onTimePercent: 50,
      cancelled: 1,
    });
  });

  it('lists what happened newest first, with who marked it', () => {
    const events = kitchenEvents(tickets);
    expect(events.slice(0, 4).map((e) => [e.ticket.orderId, e.kind])).toEqual([
      ['A3', 'received'],
      ['A1', 'served'],
      ['A1', 'ready'],
      ['A2', 'ready'],
    ]);
    expect(events.find((e) => e.kind === 'started')?.by).toBe('Ravi');
    expect(filterEvents(events, 'started', '').length).toBe(1);
    expect(filterEvents(events, 'all', 'ravi').map((e) => e.kind)).toEqual(['started']);
  });

  it('counts tickets by the branch’s hour, every hour between, and names hours its way', () => {
    const hours = ticketsByHour(tickets, branch);
    expect(hours.map((h) => [h.hour, h.tickets])).toEqual([[19, 2]]);
    // Kathmandu is 5:45 ahead of UTC: 13:30 UTC is 19:15 there.
    expect(localHour('2026-10-14T13:30:00Z', testBranch('ktm-thamel'))).toBe(19);
    expect(hourLabel(19, branch)).toBe('7 PM');
    expect(hourLabel(0, branch)).toBe('12 AM');
  });

  it('ranks the dishes ordered most, leaving cancelled tickets out', () => {
    expect(topDishes(tickets).map((d) => [d.name, d.quantity])).toEqual([
      ['naan', 3],
      ['curry', 1],
    ]);
  });
});

describe('kitchen pages', () => {
  it('knows the kitchen page from the address, and guards it like the dashboard', () => {
    expect(activeKitchenNavId('/admin/kitchen-dashboard/')).toBe('board');
    expect(activeKitchenNavId('/admin/kitchen-dashboard/activity')).toBe('activity');
    expect(adminPage('/admin/kitchen-dashboard')).toBe('dashboard');
    expect(adminPage('/admin/kitchen-dashboard/activity/')).toBe('dashboard');
  });
});
