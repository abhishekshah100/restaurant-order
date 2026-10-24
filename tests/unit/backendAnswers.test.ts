import { hydrate } from '@tanstack/react-query';
import { beforeAll, describe, expect, it } from 'vitest';
import { adaptBackendAnswer } from '@/api/backendAnswers';
import type { BackendOrder } from '@/api/orderAdapter';
import { getQueryClient } from '@/api/queryClient';
import type { Order } from '@/types/order';
import { createApiState } from '../apiState';

/*
 * The backend's answers in the contract's shapes (api/backendAnswers, api/orderAdapter): orders
 * come as data and are worded here like the mock's, staff never see guests' tokens, other routes
 * pass through.
 */

beforeAll(() => {
  // The adapter reads the branches, menus and words from the app's cache.
  hydrate(getQueryClient(), createApiState());
});

const PLACED = '2026-10-15T14:15:00.000Z'; // 7:45 PM in India

function backendOrder(over: Partial<BackendOrder> = {}): BackendOrder {
  return {
    id: 'A007',
    branchId: 'blr-indiranagar',
    mode: 'dineIn',
    table: 5,
    customerName: 'Ananya Rao',
    placedBy: 'you',
    fromThisSession: true,
    source: 'guest',
    placedAt: PLACED,
    status: 'preparing',
    itemTotal: 639,
    total: 671,
    payment: {
      method: 'online',
      status: 'paid',
      methodId: 'upi',
      transactionRef: 'SIM-1',
      transactions: [
        {
          id: 'A007-T1',
          kind: 'payment',
          amount: 671,
          channel: 'online',
          method: 'upi',
          at: PLACED,
        },
      ],
    },
    rounds: [
      {
        number: 1,
        placedAt: PLACED,
        status: 'preparing',
        items: [
          {
            dishSlug: 'paneer-tikka',
            name: 'Paneer Tikka',
            veg: true,
            variantName: 'Full · 10 pcs',
            quantity: 1,
            unitPrice: 639,
            config: {
              dishSlug: 'paneer-tikka',
              variantId: 'full',
              addOnIds: ['extra-paneer'],
              options: { spice: 'Medium' },
              removals: [],
              instructions: ['Less oil'],
              note: 'No onion',
            },
          },
        ],
        timeline: [
          { status: 'received', at: PLACED, note: 'paidOnline' },
          { status: 'preparing', at: '2026-10-15T14:20:00.000Z', by: 'Kiran' },
        ],
        changeableUntil: '2026-10-15T14:17:00.000Z',
      },
    ],
    estimateMinutes: { min: 18, max: 22 },
    live: true,
    ...over,
  };
}

const read = (order: BackendOrder, path = 'orders/A007?sessionId=tok-1') =>
  adaptBackendAnswer<Order>({ method: 'GET', path }, order as unknown as Order);

describe("a backend order in the screens' shape", () => {
  it('words its items from the menu, its steps on the branch clock, its payment by name', async () => {
    const order = await read(backendOrder());
    expect(order.items[0]).toMatchObject({
      name: 'Paneer Tikka',
      variant: 'Full',
      details: ['Full · 10 pcs, Medium spicy, Extra paneer (4 pcs) (+₹90)'],
      note: 'Less oil, No onion',
      status: 'preparing',
    });
    expect(order.timeline).toEqual([
      { status: 'received', time: '7:45 PM', at: PLACED, note: 'Paid online' },
      { status: 'preparing', time: '7:50 PM', at: '2026-10-15T14:20:00.000Z' },
    ]);
    expect(order.rounds?.[0]?.kitchen).toEqual({
      started: { at: '2026-10-15T14:20:00.000Z', by: 'Kiran' },
    });
    expect(order.payment).toMatchObject({ method: 'online', status: 'paid', detail: 'UPI' });
    // Waiting for the food: due within the branch's usual time.
    expect(order.readyBy).toBe('8:07 PM');
  });

  it("marks only this session's orders as the guest's own, and never shows another token", async () => {
    expect((await read(backendOrder())).sessionId).toBe('tok-1');
    const earlier = await read(backendOrder({ fromThisSession: false }));
    expect(earlier.sessionId).toBe('guest:A007');
    const waiters = await read(
      backendOrder({ fromThisSession: false, placedBy: 'other', source: 'staff' }),
    );
    expect(waiters.sessionId).toBeUndefined();
  });

  it('tells the guest why the restaurant cancelled, and that a waiter took a round', async () => {
    const cancelled = await read(
      backendOrder({
        status: 'cancelled',
        cancelledBy: 'restaurant',
        cancelReason: 'outOfStock',
        rounds: [
          {
            ...backendOrder().rounds[0]!,
            status: 'cancelled',
            timeline: [{ status: 'received', at: PLACED, note: 'takenBy', by: 'Arjun' }],
          },
        ],
      }),
    );
    expect(cancelled.cancelReason).toBe('An item ran out in the kitchen');
    expect(cancelled.rounds?.[0]?.timeline[0]?.note).toBe('Taken by Arjun');
  });

  it('adapts the orders in lists and changes, and leaves other answers as they are', async () => {
    const list = await adaptBackendAnswer<{ orders: Order[] }>(
      { method: 'GET', path: 'sessions/tok-2/orders' },
      { orders: [backendOrder()] } as unknown as { orders: Order[] },
    );
    expect(list.orders[0]?.sessionId).toBe('tok-2');
    const change = await adaptBackendAnswer<{ order: Order; refunded: number }>(
      { method: 'PATCH', path: 'orders/A007', body: { sessionId: 'tok-3' } },
      { order: backendOrder(), refunded: 0 } as unknown as { order: Order; refunded: number },
    );
    expect(change).toMatchObject({ refunded: 0, order: { sessionId: 'tok-3' } });
    // "qr-codes" isn't a table: the links pass as they are.
    const codes = { codes: [{ table: 5 }] };
    expect(
      await adaptBackendAnswer(
        { method: 'GET', path: 'admin/branches/blr/tables/qr-codes' },
        codes,
      ),
    ).toBe(codes);
    const branches = [{ id: 'x' }];
    expect(await adaptBackendAnswer({ method: 'GET', path: 'branches' }, branches)).toBe(branches);
  });

  it("shows staff requests without a guest's token", async () => {
    const answer = await adaptBackendAnswer<{ request: { sessionId: string } }>(
      { method: 'POST', path: 'admin/service-requests/abc/resolve' },
      { request: { id: 'abc', kind: 'waiter' } } as unknown as { request: { sessionId: string } },
    );
    expect(answer.request.sessionId).toBe('');
  });
});
