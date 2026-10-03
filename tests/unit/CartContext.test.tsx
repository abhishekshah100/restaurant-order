import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { CartProvider } from '@/context/CartContext';
import { GuestSessionProvider } from '@/context/GuestSessionContext';
import { ToastProvider } from '@/context/ToastContext';
import { useCart, useCartActions, useDishLines, useDishQuantity } from '@/hooks/useCart';
import { defaultConfig } from '@/lib/cartLine';
import { STORAGE_KEYS } from '@/lib/storage';
import type { Dish } from '@/types/menu';
import { ApiTestProvider, seedGuestSession, testMenu } from '../apiState';

const menu = testMenu();
const kebab = menu.getDish('dahi-kebab') as Dish;
const paneer = menu.getDish('paneer-tikka') as Dish;

const wrapper = ({ children }: { children: ReactNode }) => (
  <ApiTestProvider>
    <GuestSessionProvider>
      <ToastProvider>
        <CartProvider>{children}</CartProvider>
      </ToastProvider>
    </GuestSessionProvider>
  </ApiTestProvider>
);

/** Clicks Undo on the current toast. */
function undo() {
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Undo');
  expect(button).toBeDefined();
  act(() => button?.click());
}

describe('CartProvider', () => {
  it('drops malformed saved lines instead of crashing', () => {
    const { id: sessionId } = seedGuestSession();
    const good = {
      ...defaultConfig(kebab),
      key: 'x',
      quantity: 2,
      unitPrice: 1,
    };
    window.localStorage.setItem(
      STORAGE_KEYS.cart,
      JSON.stringify({
        sessionId,
        kitchenNote: '',
        lines: [{ ...good, options: null }, { ...good, quantity: 'lots' }, good],
      }),
    );
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.hydrated).toBe(true);
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0]).toMatchObject({ dishSlug: 'dahi-kebab', quantity: 2 });
    expect(result.current.lines[0].unitPrice).toBe(kebab.price);
  });

  it('undo of an add takes back only what was added', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(kebab, defaultConfig(kebab), 2));
    const key = result.current.lines[0].key;
    act(() => result.current.setQuantity(key, 5));
    undo();
    expect(result.current.lines[0].quantity).toBe(3);
  });

  it('reads the latest cart on back-to-back actions', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    // Two adds in one tick: the second toast's undo must know the line existed.
    act(() => {
      result.current.addItem(kebab, defaultConfig(kebab));
      result.current.addItem(kebab, defaultConfig(kebab));
    });
    expect(result.current.lines[0].quantity).toBe(2);
    undo();
    expect(result.current.lines[0].quantity).toBe(1);

    // Remove right after adding another dish: the removed line is restored intact.
    act(() => {
      result.current.addItem(paneer, defaultConfig(paneer), 1, { toast: false });
      result.current.removeLine(result.current.lines[0].key);
    });
    expect(result.current.lines.map((l) => l.dishSlug)).toEqual(['paneer-tikka']);
    undo();
    expect(result.current.lines.map((l) => l.dishSlug)).toEqual(['dahi-kebab', 'paneer-tikka']);
  });

  it('per-dish hooks only change when that dish changes', () => {
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders++;
        return {
          actions: useCartActions(),
          lines: useDishLines('dahi-kebab'),
          quantity: useDishQuantity('dahi-kebab'),
        };
      },
      { wrapper },
    );
    const { actions } = result.current;
    act(() => actions.addItem(kebab, defaultConfig(kebab), 2, { toast: false }));
    expect(result.current.quantity).toBe(2);
    const lines = result.current.lines;
    const before = renders;

    act(() => actions.addItem(paneer, defaultConfig(paneer), 1, { toast: false }));
    act(() => actions.setKitchenNote('No ice'));
    expect(renders).toBe(before);
    expect(result.current.lines).toBe(lines);
    expect(result.current.actions).toBe(actions);

    act(() => actions.setQuantity(lines[0].key, 3));
    expect(result.current.quantity).toBe(3);
  });

  it('follows carts changed in another tab', () => {
    const { id: sessionId } = seedGuestSession();
    const { result } = renderHook(() => useCart(), { wrapper });
    const line = { ...defaultConfig(kebab), key: 'k', quantity: 4, unitPrice: 0 };
    window.localStorage.setItem(
      STORAGE_KEYS.cart,
      JSON.stringify({ sessionId, kitchenNote: '', lines: [line] }),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.cart }));
    });
    expect(result.current.count).toBe(4);
  });

  it('discards a cart saved by another guest session', () => {
    const { id: sessionId } = seedGuestSession();
    const line = { ...defaultConfig(kebab), key: 'k', quantity: 2, unitPrice: 0 };
    const otherCart = { sessionId: 'another-guest', kitchenNote: 'Hi', lines: [line] };
    window.localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(otherCart));
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.hydrated).toBe(true);
    expect(result.current.lines).toEqual([]);
    expect(result.current.kitchenNote).toBe('');
    // The empty cart is saved for this session, replacing the other one.
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.cart) ?? '')).toEqual({
      sessionId,
      kitchenNote: '',
      lines: [],
    });

    // The same happens when another tab saves a cart for another session.
    act(() => result.current.addItem(kebab, defaultConfig(kebab), 1, { toast: false }));
    window.localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(otherCart));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.cart }));
    });
    expect(result.current.count).toBe(0);
  });
});
