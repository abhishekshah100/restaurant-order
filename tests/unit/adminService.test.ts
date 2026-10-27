import { describe, expect, it } from 'vitest';
import { activeNavId, ADMIN_NAV } from '@/lib/adminNav';
import {
  dayPeriod,
  minutesSince,
  serviceQueue,
  withoutReadyRound,
  withoutRequest,
} from '@/lib/adminService';
import type { AdminBranchService, AdminOrderSummary } from '@/types/admin';

/* The waiter home's pure logic: the queue, its optimistic updates, the greeting and the nav. */

const order = (id: string, readyAt: string[], extra: Partial<AdminOrderSummary> = {}) =>
  ({
    id,
    mode: 'dineIn',
    table: 5,
    customerName: 'Ananya',
    placedAt: '2026-10-14T13:00:00.000Z',
    status: 'ready',
    itemCount: 2,
    total: 700,
    due: 700,
    paymentStatus: 'unpaid',
    readyRounds: readyAt.map((at, i) => ({ round: i + 1, itemCount: 1, readyAt: at })),
    ...extra,
  }) satisfies AdminOrderSummary;

const service: AdminBranchService = {
  doneRequests: [],
  requests: [
    {
      id: 'w1',
      kind: 'waiter',
      reason: 'water',
      table: 12,
      sessionId: 's12',
      requestedAt: '2026-10-14T13:20:00.000Z',
    },
    {
      id: 'b1',
      kind: 'bill',
      scope: 'table',
      balance: 1424,
      table: 3,
      sessionId: 's3',
      requestedAt: '2026-10-14T13:05:00.000Z',
    },
  ],
  orders: [
    order('A105', ['2026-10-14T13:10:00.000Z', '2026-10-14T13:25:00.000Z']),
    order('A106', [], { status: 'preparing' }),
  ],
  tables: [],
  counts: { waiterCalls: 1, billRequests: 1, readyToServe: 2, unpaid: 2 },
  generatedAt: '2026-10-14T13:30:00.000Z',
};

describe('serviceQueue', () => {
  it('puts the kitchen’s messages in the queue, and counts them off when done', () => {
    const withMessage: AdminBranchService = {
      ...service,
      requests: [
        ...service.requests,
        {
          id: 'k1',
          kind: 'kitchen',
          reason: 'unavailable',
          orderId: 'A106',
          mode: 'takeaway',
          requestedAt: '2026-10-14T13:15:00.000Z',
        },
      ],
      counts: { ...service.counts, kitchenMessages: 1 },
    };
    expect(serviceQueue(withMessage).find((item) => item.key === 'request:k1')?.kind).toBe(
      'kitchen',
    );
    expect(withoutRequest(withMessage, 'k1').counts).toMatchObject({
      kitchenMessages: 0,
      waiterCalls: 1,
      billRequests: 1,
    });
  });

  it('mixes requests and ready rounds, oldest first', () => {
    expect(serviceQueue(service).map((item) => item.key)).toEqual([
      'request:b1',
      'ready:A105:1',
      'request:w1',
      'ready:A105:2',
    ]);
  });

  it('is empty when nothing waits', () => {
    expect(serviceQueue({ requests: [], orders: [order('A1', [])] })).toEqual([]);
  });
});

describe('optimistic updates', () => {
  it('withoutRequest drops the request and its count', () => {
    const next = withoutRequest(service, 'b1');
    expect(next.requests.map((r) => r.id)).toEqual(['w1']);
    expect(next.counts).toMatchObject({ waiterCalls: 1, billRequests: 0 });
    expect(withoutRequest(service, 'nope')).toBe(service);
  });

  it('withoutReadyRound drops one round, or every ready round without one', () => {
    const one = withoutReadyRound(service, 'A105', 2);
    expect(one.orders[0].readyRounds.map((r) => r.round)).toEqual([1]);
    expect(one.counts.readyToServe).toBe(1);
    const all = withoutReadyRound(service, 'A105');
    expect(all.orders[0].readyRounds).toEqual([]);
    expect(all.counts.readyToServe).toBe(0);
    expect(withoutReadyRound(service, 'A106')).toBe(service);
  });
});

describe('dayPeriod (the greeting)', () => {
  // 06:20 UTC is 11:50 in Kolkata (UTC+5:30) and 12:05 in Kathmandu (UTC+5:45).
  const at = new Date('2026-10-14T06:20:00Z');

  it("goes by the branch's time zone, not the device's", () => {
    expect(dayPeriod(at, 'Asia/Kolkata')).toBe('morning');
    expect(dayPeriod(at, 'Asia/Kathmandu')).toBe('afternoon');
  });

  it('morning from 5:00, afternoon from 12:00, evening from 17:00 until 5:00', () => {
    const local = (time: string) => new Date(`2026-10-14T${time}:00+05:30`);
    expect(dayPeriod(local('04:59'), 'Asia/Kolkata')).toBe('evening');
    expect(dayPeriod(local('05:00'), 'Asia/Kolkata')).toBe('morning');
    expect(dayPeriod(local('12:00'), 'Asia/Kolkata')).toBe('afternoon');
    expect(dayPeriod(local('16:59'), 'Asia/Kolkata')).toBe('afternoon');
    expect(dayPeriod(local('17:00'), 'Asia/Kolkata')).toBe('evening');
    expect(dayPeriod(local('23:30'), 'Asia/Kolkata')).toBe('evening');
  });
});

describe('minutesSince', () => {
  it('counts whole minutes, never below zero', () => {
    const now = new Date('2026-10-14T13:30:00Z');
    expect(minutesSince('2026-10-14T13:26:59Z', now)).toBe(3);
    expect(minutesSince('2026-10-14T13:31:00Z', now)).toBe(0);
  });
});

describe('activeNavId', () => {
  it('matches each page and the pages under it, with or without the trailing slash', () => {
    expect(activeNavId('/admin/dashboard/')).toBe('home');
    expect(activeNavId('/admin/dashboard')).toBe('home');
    expect(activeNavId('/admin/dashboard/tables')).toBe('tables');
    expect(activeNavId('/admin/dashboard/orders/ready/')).toBe('orders');
    expect(activeNavId('/admin/dashboard/orders/unpaid')).toBe('orders');
    expect(activeNavId('/admin/dashboard/payments/')).toBe('payments');
  });

  it('matches nothing outside the dashboard, or a page that only starts the same', () => {
    expect(activeNavId('/admin/select-branch/')).toBeUndefined();
    expect(activeNavId('/admin/dashboard/ordersx/')).toBeUndefined();
  });

  it('puts the waiter pages on the mobile tab bar and the rest in More', () => {
    expect(ADMIN_NAV.filter((item) => item.tab).map((item) => item.id)).toEqual([
      'home',
      'tables',
      'orders',
      'requests',
    ]);
    const counts = { waiterCalls: 2, billRequests: 1, readyToServe: 4, unpaid: 3 };
    const badge = (id: string) => ADMIN_NAV.find((item) => item.id === id)?.badge?.(counts);
    expect(badge('requests')).toBe(3);
    expect(badge('orders')).toBe(4);
    expect(badge('home')).toBeUndefined();
  });
});
