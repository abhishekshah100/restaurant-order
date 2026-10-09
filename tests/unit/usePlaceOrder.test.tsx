import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MOCK_KEYS } from '@/api/mock/db';
import { useCart } from '@/hooks/useCart';
import { usePlaceOrderState } from '@/hooks/usePlaceOrder';
import { defaultConfig } from '@/lib/cartLine';
import type { Dish } from '@/types/menu';
import { TestProviders, createTestServer, seedGuestSession, testMenu } from '../apiState';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/checkout/payment/',
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <TestProviders>{children}</TestProviders>
);

const storedOrders = () =>
  JSON.parse(window.localStorage.getItem(MOCK_KEYS.orders) ?? '[]') as { id: string }[];

/** A guest session whose number has been verified, as the checkout leaves it. */
async function verifiedGuest() {
  const { id: sessionId } = seedGuestSession();
  const server = createTestServer();
  const phone = '9876543210';
  await server({ method: 'POST', path: 'otp', body: { sessionId, phone } });
  await server({ method: 'POST', path: 'otp/verify', body: { sessionId, phone, code: '123456' } });
}

async function setup() {
  await verifiedGuest();
  const view = renderHook(() => ({ cart: useCart(), order: usePlaceOrderState() }), { wrapper });
  await waitFor(() => expect(view.result.current.cart.hydrated).toBe(true));
  return view;
}

describe('usePlaceOrder', () => {
  beforeEach(() => replace.mockClear());

  it('places one order on a double tap', async () => {
    const { result } = await setup();
    const kebab = testMenu().getDish('dahi-kebab') as Dish;
    act(() => result.current.cart.addItem(kebab, defaultConfig(kebab), 1, { toast: false }));
    act(() => {
      result.current.order.placeOrder('counter');
      result.current.order.placeOrder('counter');
    });
    act(() => result.current.order.placeOrder('counter'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/order/confirmed/?id=A105'));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(storedOrders()).toHaveLength(1);
    expect(result.current.order.placing).toBe(true);
  });

  it('ignores an empty cart', async () => {
    const { result } = await setup();
    act(() => result.current.order.placeOrder('online'));
    expect(storedOrders()).toHaveLength(0);
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.order.placing).toBe(false);
  });
});
