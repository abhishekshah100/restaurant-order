import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { TestProviders, testMenu } from '../apiState';
import { useCart } from '@/hooks/useCart';
import { usePlaceOrderState } from '@/hooks/usePlaceOrder';
import { defaultConfig } from '@/lib/cartLine';
import { STORAGE_KEYS } from '@/lib/storage';
import type { Dish } from '@/types/menu';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/checkout/payment/',
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <TestProviders>{children}</TestProviders>
);

const storedOrders = () =>
  JSON.parse(window.localStorage.getItem(STORAGE_KEYS.orders) ?? '[]') as { id: string }[];

function setup() {
  return renderHook(() => ({ cart: useCart(), order: usePlaceOrderState() }), { wrapper });
}

describe('usePlaceOrder', () => {
  beforeEach(() => replace.mockClear());

  it('places one order on a double tap', () => {
    const { result } = setup();
    const kebab = testMenu().getDish('dahi-kebab') as Dish;
    act(() => result.current.cart.addItem(kebab, defaultConfig(kebab), 1, { toast: false }));
    act(() => {
      result.current.order.placeOrder('counter');
      result.current.order.placeOrder('counter');
    });
    act(() => result.current.order.placeOrder('counter'));
    expect(storedOrders()).toHaveLength(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/order/A105/confirmed/');
    expect(result.current.order.placing).toBe(true);
  });

  it('ignores an empty cart', () => {
    const { result } = setup();
    act(() => result.current.order.placeOrder('online'));
    expect(storedOrders()).toHaveLength(0);
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.order.placing).toBe(false);
  });
});
