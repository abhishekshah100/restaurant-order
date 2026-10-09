import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLiveOrder, useLiveOrderList } from '@/components/order/useLiveOrders';
import { usePayBill } from '@/components/service/usePayBill';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { defaultConfig, orderLine, unitPrice } from '@/lib/cartLine';
import type { Dish } from '@/types/menu';
import type { Order } from '@/types/order';
import { TestProviders, createTestServer, seedGuestSession, testMenu } from '../apiState';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/help/',
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <TestProviders>{children}</TestProviders>
);

/** This device's guest session with a verified number and a counter order placed through the API. */
async function guestWithOrder(): Promise<Order> {
  const { id: sessionId } = seedGuestSession();
  const server = createTestServer();
  const phone = '9876543210';
  await server({ method: 'POST', path: 'otp', body: { sessionId, phone } });
  await server({ method: 'POST', path: 'otp/verify', body: { sessionId, phone, code: '123456' } });
  const dish = testMenu().getDish('dahi-kebab') as Dish;
  const config = defaultConfig(dish);
  const line = orderLine({ ...config, key: 'k', quantity: 1, unitPrice: unitPrice(dish, config) });
  const res = await server({
    method: 'POST',
    path: 'orders',
    body: {
      sessionId,
      customerName: 'Rohan',
      method: 'counter',
      kitchenNote: '',
      lines: [line],
      fulfilment: { mode: 'dineIn' },
    },
  });
  return res?.body as Order;
}

beforeEach(() => push.mockClear());

describe('order reads', () => {
  it('useLiveOrder: loading, then the live order; unknown ids are missing', async () => {
    const order = await guestWithOrder();
    const { result } = renderHook(() => useLiveOrder(order.id), { wrapper });
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('found'));
    expect(result.current).toMatchObject({
      order: { id: order.id, status: 'received' },
      live: true,
    });

    const missing = renderHook(() => useLiveOrder('A123'), { wrapper });
    await waitFor(() => expect(missing.result.current.state).toBe('missing'));
    // No id yet (the page is hydrating) or none in the URL.
    expect(renderHook(() => useLiveOrder(undefined), { wrapper }).result.current.state).toBe(
      'loading',
    );
    expect(renderHook(() => useLiveOrder(null), { wrapper }).result.current.state).toBe('missing');
  });

  it("useLiveOrderList: the guest's orders with their drawn history", async () => {
    const order = await guestWithOrder();
    const { result } = renderHook(() => useLiveOrderList(), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    const ids = result.current?.orders.map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining([order.id, 'A104']));
  });
});

describe('service requests (context over the API)', () => {
  it('sends a waiter request, shows it, and cancels it', async () => {
    seedGuestSession();
    const { result } = renderHook(() => useServiceRequest(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.requests).toEqual({ waiter: undefined, bill: undefined });

    act(() => result.current.sendWaiterRequest('water', ' High chair '));
    await waitFor(() => expect(result.current.requests.waiter).toBeDefined());
    expect(result.current.requests.waiter).toMatchObject({ reason: 'water', note: 'High chair' });
    expect(push).toHaveBeenCalledWith('/help/waiter-requested/');

    // Removed before the server answers (and restored if it refuses).
    act(() => result.current.cancelRequest('waiter'));
    await waitFor(() => expect(result.current.requests.waiter).toBeUndefined());
  });
});

describe('usePayBill', () => {
  it('pays the guest’s own unpaid order and records it once', async () => {
    const order = await guestWithOrder();
    const { result } = renderHook(() => usePayBill(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.bill.payable.map((o) => o.id)).toEqual([order.id]);

    let payment: Awaited<ReturnType<typeof result.current.startPayment>> = null;
    await act(async () => {
      payment = await result.current.startPayment('upi');
    });
    expect(payment).toMatchObject({ orderIds: [order.id], amount: order.total, method: 'upi' });
    if (!payment) throw new Error('expected a payment');

    const paid = payment;
    let receipts: unknown[] = [];
    await act(async () => {
      // A double tap records one payment.
      receipts = await Promise.all([
        result.current.completePayment(paid),
        result.current.completePayment(paid),
      ]);
    });
    expect(receipts[0]).toMatchObject({ amount: order.total, method: 'upi' });
    expect(receipts[1]).toBe(receipts[0]);
    expect(result.current.settled).toBe(true);
    await waitFor(() => expect(result.current.bill.payable).toEqual([]));
  });
});
