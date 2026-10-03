import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { OrdersProvider, useOrders } from '@/context/OrdersContext';
import { defaultConfig, lineKey, unitPrice } from '@/lib/cartLine';
import { buildOrder, isOrder, isOwnOrder, markOrdersPaid } from '@/lib/orders';
import { STORAGE_KEYS } from '@/lib/storage';
import type { CartLine } from '@/types/cart';
import type { Dish } from '@/types/menu';
import {
  ApiTestProvider,
  testMenu,
  testOrderHistory,
  testLineLabels,
  testRestaurant,
} from '../apiState';

const menu = testMenu();
const labels = {
  paidOnline: 'Paid online',
  payAtCounter: 'Pay at counter',
  upi: 'UPI',
  lineLabels: testLineLabels(),
  estimate: testRestaurant().prepTime,
};
const mockOrders = testOrderHistory().history;

const kebab = menu.getDish('dahi-kebab') as Dish;
const config = defaultConfig(kebab);
const line: CartLine = {
  ...config,
  key: lineKey(config),
  quantity: 2,
  unitPrice: unitPrice(kebab, config),
};
const input = {
  lines: [line],
  table: 12,
  sessionId: 'guest-1',
  customerName: 'Ananya',
  method: 'counter' as const,
  kitchenNote: '',
};

describe('buildOrder', () => {
  it('builds an order with the prep-time estimate', () => {
    const order = buildOrder({ ...input, id: 'A105' }, menu, labels);
    expect(order).toMatchObject({
      id: 'A105',
      estimate: '18–22 min',
      table: 12,
      placedBy: 'you',
      sessionId: 'guest-1',
    });
    expect(order?.items[0]).toMatchObject({ dishSlug: 'dahi-kebab', quantity: 2 });
  });

  it('refuses an empty cart', () => {
    expect(buildOrder({ ...input, id: 'A105', lines: [] }, menu, labels)).toBeNull();
  });
});

describe('isOrder', () => {
  const order = buildOrder({ ...input, id: 'A105' }, menu, labels);

  it('accepts built and mock orders', () => {
    expect(isOrder(order)).toBe(true);
    expect(mockOrders.every(isOrder)).toBe(true);
    expect(isOrder(JSON.parse(JSON.stringify(mockOrders[0])))).toBe(true);
  });

  it('rejects orders the confirmation page could not render', () => {
    expect(isOrder(null)).toBe(false);
    expect(isOrder({ ...order, payment: null })).toBe(false);
    expect(isOrder({ ...order, payment: { method: 'cash', status: 'paid' } })).toBe(false);
    expect(isOrder({ ...order, items: [{ name: 'x' }] })).toBe(false);
    expect(isOrder({ ...order, table: '12' })).toBe(false);
    expect(isOrder({ ...order, timeline: undefined })).toBe(false);
    expect(isOrder({ ...order, sessionId: 7 })).toBe(false);
  });
});

describe('isOwnOrder', () => {
  const order = buildOrder({ ...input, id: 'A105' }, menu, labels);
  if (!order) throw new Error('expected an order');

  it('matches orders by the session that placed them', () => {
    expect(isOwnOrder(order, 'guest-1')).toBe(true);
    // Placed on this device, but in an earlier session (or by another guest's session).
    expect(isOwnOrder(order, 'guest-2')).toBe(false);
    expect(isOwnOrder(order, undefined)).toBe(false);
  });

  it("never counts orders without a session as anyone's own", () => {
    const { sessionId: _sessionId, ...legacy } = order;
    expect(isOwnOrder({ ...legacy, sessionId: undefined }, 'guest-2')).toBe(false);
    // The drawn history has no sessions, so it belongs to the table, not to any one guest.
    expect(mockOrders.some((o) => o.sessionId)).toBe(false);
    expect(mockOrders.filter((o) => isOwnOrder(o, 'guest-2'))).toEqual([]);
  });
});

describe('markOrdersPaid', () => {
  const unpaid = buildOrder({ ...input, id: 'A105' }, menu, labels)!;
  const paid = buildOrder({ ...input, id: 'A106', method: 'online' }, menu, labels)!;
  const other = buildOrder({ ...input, id: 'A107' }, menu, labels)!;
  const payment = { detail: 'Card', transactionRef: '•••• 4821' };

  it('marks only the listed unpaid orders as paid online', () => {
    const { orders, marked } = markOrdersPaid([unpaid, paid, other], ['A105', 'A106'], payment);
    expect(marked.map((o) => o.id)).toEqual(['A105']);
    expect(orders[0].payment).toEqual({ method: 'online', status: 'paid', ...payment });
    // Already paid and unlisted orders are left exactly as they were.
    expect(orders[1]).toBe(paid);
    expect(orders[2]).toBe(other);
  });

  it('changes nothing when paying twice', () => {
    const first = markOrdersPaid([unpaid], ['A105'], payment);
    const second = markOrdersPaid(first.orders, ['A105'], payment);
    expect(second.marked).toEqual([]);
    expect(second.orders).toEqual(first.orders);
  });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <ApiTestProvider>
    <OrdersProvider>{children}</OrdersProvider>
  </ApiTestProvider>
);

describe('OrdersProvider', () => {
  it('keeps orders placed in another tab', () => {
    const { result } = renderHook(() => useOrders(), { wrapper });
    // Another tab places A105 after this one loaded.
    const other = buildOrder({ ...input, id: 'A105' }, menu, labels);
    window.localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify([other]));

    let placed: ReturnType<typeof result.current.placeOrder> = null;
    act(() => {
      placed = result.current.placeOrder(input);
    });
    expect(placed).toMatchObject({ id: 'A106' });
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.orders) ?? '[]');
    expect(stored.map((o: { id: string }) => o.id)).toEqual(['A106', 'A105']);
    expect(result.current.placed.map((o) => o.id)).toEqual(['A106', 'A105']);
  });

  it('picks up orders from a storage event', () => {
    const { result } = renderHook(() => useOrders(), { wrapper });
    const other = buildOrder({ ...input, id: 'A110' }, menu, labels);
    window.localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify([other]));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.orders }));
    });
    expect(result.current.placed.map((o) => o.id)).toEqual(['A110']);
  });

  it('places nothing for an empty cart', () => {
    const { result } = renderHook(() => useOrders(), { wrapper });
    act(() => {
      expect(result.current.placeOrder({ ...input, lines: [] })).toBeNull();
    });
    expect(result.current.placed).toEqual([]);
  });

  it('marks orders paid, saves them and ignores a repeat', () => {
    const { result } = renderHook(() => useOrders(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.placeOrder(input)?.id ?? '';
    });
    let marked: ReturnType<typeof result.current.markPaid> = [];
    act(() => {
      marked = result.current.markPaid([id], 'upi');
    });
    expect(marked.map((o) => o.id)).toEqual([id]);
    expect(result.current.placed[0].payment).toMatchObject({
      method: 'online',
      status: 'paid',
      detail: 'UPI',
    });
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.orders) ?? '[]');
    expect(stored[0].payment.status).toBe('paid');
    act(() => {
      expect(result.current.markPaid([id], 'card')).toEqual([]);
    });
    expect(result.current.placed[0].payment.detail).toBe('UPI');
  });
});
