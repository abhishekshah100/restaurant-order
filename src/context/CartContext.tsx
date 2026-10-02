'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { CartLine, CartState, LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { getDish } from '@/lib/menu';
import { calculateBill, type Bill } from '@/lib/pricing';
import { lineKey, unitPrice } from '@/lib/cartLine';
import { EMPTY_CART, cartReducer, isCartState } from '@/lib/cartReducer';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';
import { useToast } from './ToastContext';

export interface CartContextValue {
  lines: CartLine[];
  kitchenNote: string;
  bill: Bill;
  /** Total quantity across lines. */
  count: number;
  /** False until the saved cart has been read from this device. */
  hydrated: boolean;
  addItem: (
    dish: Dish,
    config: LineConfig,
    quantity?: number,
    options?: { toast?: boolean },
  ) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  editLine: (key: string, dish: Dish, config: LineConfig, quantity: number) => void;
  setKitchenNote: (note: string) => void;
  clear: () => void;
  linesForDish: (slug: string) => CartLine[];
}

const CartContext = createContext<CartContextValue | null>(null);

interface ProviderState {
  cart: CartState;
  hydrated: boolean;
}

type ProviderAction = Parameters<typeof cartReducer>[1];

function providerReducer(state: ProviderState, action: ProviderAction): ProviderState {
  const cart = cartReducer(state.cart, action);
  return { cart, hydrated: state.hydrated || action.type === 'hydrate' };
}

/** Re-prices saved lines against the current menu and drops dishes that no longer exist. */
function reconcile(saved: CartState): CartState {
  const lines = saved.lines.flatMap((line) => {
    const dish = getDish(line.dishSlug);
    if (!dish) return [];
    return [{ ...line, key: lineKey(line), unitPrice: unitPrice(dish, line) }];
  });
  return { kitchenNote: saved.kitchenNote, lines };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(providerReducer, { cart: EMPTY_CART, hydrated: false });
  const { showToast } = useToast();
  const { cart, hydrated } = state;
  const cartRef = useRef(cart);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // Read the saved cart after mount so server HTML and the first client render match.
  useEffect(() => {
    const saved = readJSON(STORAGE_KEYS.cart, isCartState);
    dispatch({ type: 'hydrate', state: saved ? reconcile(saved) : EMPTY_CART });
  }, []);

  useEffect(() => {
    if (hydrated) writeJSON(STORAGE_KEYS.cart, cart);
  }, [cart, hydrated]);

  // Keep carts in sync across tabs on the same device.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.cart) return;
      const saved = readJSON(STORAGE_KEYS.cart, isCartState);
      dispatch({ type: 'hydrate', state: saved ? reconcile(saved) : EMPTY_CART });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const removeLine = useCallback(
    (key: string) => {
      const index = cartRef.current.lines.findIndex((l) => l.key === key);
      const line = cartRef.current.lines[index];
      if (!line) return;
      dispatch({ type: 'remove', key });
      const name = getDish(line.dishSlug)?.name ?? 'Item';
      showToast(`${name} removed`, {
        actionLabel: 'Undo',
        onAction: () => dispatch({ type: 'restore', line, index }),
      });
    },
    [showToast],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) => {
      if (quantity <= 0) removeLine(key);
      else dispatch({ type: 'setQuantity', key, quantity });
    },
    [removeLine],
  );

  const addItem = useCallback<CartContextValue['addItem']>(
    (dish, config, quantity = 1, options = {}) => {
      const key = lineKey(config);
      const before = cartRef.current.lines.find((l) => l.key === key)?.quantity ?? 0;
      dispatch({ type: 'add', config, unitPrice: unitPrice(dish, config), quantity });
      if (options.toast === false) return;
      showToast(`${dish.name} added`, {
        actionLabel: 'Undo',
        onAction: () =>
          before === 0
            ? dispatch({ type: 'remove', key })
            : dispatch({ type: 'setQuantity', key, quantity: before }),
      });
    },
    [showToast],
  );

  const editLine = useCallback<CartContextValue['editLine']>((key, dish, config, quantity) => {
    dispatch({ type: 'edit', key, config, unitPrice: unitPrice(dish, config), quantity });
  }, []);

  const setKitchenNote = useCallback(
    (note: string) => dispatch({ type: 'setKitchenNote', note }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  const value = useMemo<CartContextValue>(() => {
    const bill = calculateBill(cart.lines);
    return {
      lines: cart.lines,
      kitchenNote: cart.kitchenNote,
      bill,
      count: bill.itemCount,
      hydrated,
      addItem,
      setQuantity,
      removeLine,
      editLine,
      setKitchenNote,
      clear,
      linesForDish: (slug) => cart.lines.filter((l) => l.dishSlug === slug),
    };
  }, [cart, hydrated, addItem, setQuantity, removeLine, editLine, setKitchenNote, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
