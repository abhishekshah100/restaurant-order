import { describe, expect, it } from 'vitest';
import {
  arrivingSoon,
  counterExtras,
  floorSummary,
  inFloorFilter,
  myShift,
  soldOutTonight,
  tableFlag,
} from '@/lib/adminHome';
import type { AdminBranchService, AdminFloor, AdminFloorTable, Reservation } from '@/types/admin';
import type { Dish } from '@/types/menu';
import type { Order } from '@/types/order';

const NOW = new Date('2026-11-10T14:00:00Z');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const table = (
  number: number,
  status: AdminFloorTable['status'],
  extra: Partial<AdminFloorTable> = {},
): AdminFloorTable => ({
  table: number,
  seats: 4,
  status,
  freed: false,
  disabled: status === 'outOfService',
  orderCount: 0,
  due: 0,
  ...extra,
});

describe('the floor at a glance', () => {
  const floors: AdminFloor[] = [
    {
      id: 'ground',
      name: 'Ground floor',
      tables: [
        table(1, 'available'),
        table(2, 'reserved'),
        table(3, 'seated', { seatedAt: ago(12) }),
        table(4, 'ordering', { seatedAt: ago(30), orderCount: 1, due: 500 }),
        table(5, 'eating', { seatedAt: ago(40), orderCount: 1, due: 300 }),
        table(6, 'needsWaiter', { seatedAt: ago(5) }),
        table(7, 'outOfService'),
      ],
    },
  ];

  it('counts busy, free and reserved tables and their seats (out of service left out)', () => {
    expect(floorSummary(floors, NOW)).toEqual({
      tables: 6,
      busy: 4,
      free: 1,
      reserved: 1,
      seats: 24,
      seatsTaken: 16,
      attention: 3,
    });
  });

  it('flags a table seated 10 min with no order, and one waiting 25 min for food', () => {
    expect(tableFlag(table(3, 'seated', { seatedAt: ago(10) }), NOW)).toBe('noOrder');
    expect(tableFlag(table(3, 'seated', { seatedAt: ago(9) }), NOW)).toBeNull();
    expect(tableFlag(table(4, 'ordering', { seatedAt: ago(25) }), NOW)).toBe('longWait');
    expect(tableFlag(table(4, 'ordering', { seatedAt: ago(24) }), NOW)).toBeNull();
    expect(tableFlag(table(5, 'eating', { seatedAt: ago(90) }), NOW)).toBeNull();
  });

  it('filters: needs a look (calling, bill, flagged) and free', () => {
    const all = floors[0]?.tables ?? [];
    expect(all.filter((t) => inFloorFilter(t, 'attention', NOW)).map((t) => t.table)).toEqual([
      3, 4, 6,
    ]);
    expect(all.filter((t) => inFloorFilter(t, 'free', NOW)).map((t) => t.table)).toEqual([1]);
  });
});

describe('the counters’ second lines', () => {
  it('says how long the oldest of each has waited, and how much is unpaid', () => {
    const service = {
      requests: [
        { kind: 'waiter', requestedAt: ago(3) },
        { kind: 'waiter', requestedAt: ago(7) },
        { kind: 'bill', requestedAt: ago(2) },
      ],
      orders: [
        { due: 400, readyRounds: [{ round: 1, itemCount: 2, readyAt: ago(4) }] },
        { due: 250, readyRounds: [] },
      ],
    } as unknown as Pick<AdminBranchService, 'requests' | 'orders'>;
    expect(counterExtras(service, NOW)).toEqual({
      oldestCall: 7,
      oldestBill: 2,
      oldestReady: 4,
      unpaidAmount: 650,
    });
    expect(counterExtras({ requests: [], orders: [] }, NOW).oldestCall).toBeNull();
  });
});

describe('bookings arriving soon', () => {
  const booking = (id: string, minutesFromNow: number, status: Reservation['status'] = 'booked') =>
    ({
      id,
      status,
      at: new Date(NOW.getTime() + minutesFromNow * 60_000).toISOString(),
    }) as Reservation;

  it('lists the next two hours and up to an hour late, soonest first, booked only', () => {
    const list = arrivingSoon(
      [
        booking('later', 150),
        booking('soon', 90),
        booking('late', -30),
        booking('very-late', -90),
        booking('seated', 10, 'seated'),
        booking('now', 0),
      ],
      NOW,
    );
    expect(list.map((r) => r.id)).toEqual(['late', 'now', 'soon']);
  });
});

describe('not available tonight', () => {
  it('lists the dishes sold out or off today, by name', () => {
    const dish = (name: string, status: Dish['availability']['status']) =>
      ({ name, availability: { status } }) as Dish;
    expect(
      soldOutTonight([
        dish('Tiramisu', 'sold-out'),
        dish('Dal Makhani', 'available'),
        dish('Garlic Naan', 'unavailable-today'),
      ]).map((d) => d.name),
    ).toEqual(['Garlic Naan', 'Tiramisu']);
  });
});

describe('my shift', () => {
  const order = (over: Partial<Order>): Order =>
    ({
      id: 'X',
      status: 'served',
      table: 3,
      total: 500,
      rounds: [],
      payment: { method: 'counter', status: 'unpaid', transactions: [] },
      ...over,
    }) as unknown as Order;
  const pay = (amount: number, by: string, tip?: number) => ({
    id: 'T',
    kind: 'payment' as const,
    amount,
    channel: 'inPerson' as const,
    method: 'cash',
    at: NOW.toISOString(),
    by,
    ...(tip ? { tip } : {}),
  });

  it('counts the orders this waiter took, the tables, what they collected and their tips', () => {
    const orders = [
      order({ id: 'A', table: 3, rounds: [{ takenBy: 'Arjun Waiter' }] as Order['rounds'] }),
      order({ id: 'B', table: 3, rounds: [{ takenBy: 'arjun waiter ' }] as Order['rounds'] }),
      order({ id: 'C', table: 5, rounds: [{ takenBy: 'Priya' }] as Order['rounds'] }),
      order({
        id: 'D',
        table: 7,
        status: 'cancelled',
        rounds: [{ takenBy: 'Arjun Waiter' }] as Order['rounds'],
      }),
      order({
        id: 'E',
        table: 5,
        payment: {
          method: 'counter',
          status: 'paid',
          transactions: [pay(400, 'Arjun Waiter', 20), pay(100, 'Priya')],
        } as Order['payment'],
      }),
    ];
    expect(myShift(orders, 'Arjun Waiter')).toEqual({
      ordersTaken: 2,
      tables: 1,
      payments: 1,
      collected: 400,
      tips: 20,
    });
    expect(myShift(orders, '').ordersTaken).toBe(0);
    // On shift: only what came after clock-in (the payment was at NOW).
    const later = new Date(NOW.getTime() + 60_000).toISOString();
    expect(myShift(orders, 'Arjun Waiter', later).payments).toBe(0);
  });
});
