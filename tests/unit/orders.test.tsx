import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { OrdersProvider, useOrders } from '@/context/OrdersContext';
import { defaultConfig, lineKey, unitPrice } from '@/lib/cartLine';
import { buildOrder, isOrder, isOwnOrder } from '@/lib/orders';
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

  it('falls back to placedBy for orders without a session', () => {
    const { sessionId: _sessionId, ...legacy } = order;
    expect(isOwnOrder(legacy, 'guest-2')).toBe(true);
    expect(isOwnOrder({ ...legacy, placedBy: 'other' }, 'guest-2')).toBe(false);
    // The drawn history has no sessions: its "you" orders are this guest's.
    expect(mockOrders.some((o) => o.sessionId)).toBe(false);
    expect(mockOrders.filter((o) => isOwnOrder(o, 'guest-2'))).toEqual(
      mockOrders.filter((o) => o.placedBy === 'you'),
    );
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
});
