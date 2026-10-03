'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { CartAction, CartLine, CartState, LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { useContent, useMenu } from '@/api/hooks';
import type { ContentMap } from '@/api/queries';
import type { Translator } from '@/api/translator';
import type { MenuCatalog } from '@/lib/menu';
import { calculateBill, type Bill } from '@/lib/pricing';
import { lineKey, unitPrice } from '@/lib/cartLine';
import { normaliseConfig } from '@/lib/options';
import { EMPTY_CART, cartReducer, parseCart } from '@/lib/cartReducer';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';
import { useGuestSession } from './GuestSessionContext';
import { useToast } from './ToastContext';

/** Cart actions. Stable for the provider's lifetime. */
export interface CartActions {
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
}

export interface CartContextValue extends CartActions {
  lines: CartLine[];
  kitchenNote: string;
  bill: Bill;
  /** Total quantity across lines. */
  count: number;
  /** False until the saved cart has been read from this device. */
  hydrated: boolean;
  linesForDish: (slug: string) => CartLine[];
}

interface StoreState {
  cart: CartState;
  /** The guest session the cart belongs to; null until the saved cart has been read. */
  sessionId: string | null;
}

/**
 * The cart lives in a small external store so that per-dish hooks can subscribe
 * to just their own lines (see useDishLines) and actions always read the latest
 * state, even between a dispatch and the next render.
 */
interface CartStore {
  getState: () => StoreState;
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: CartAction) => void;
  /** Loads the guest session's saved cart. */
  hydrate: (sessionId: string, cart: CartState) => void;
  /** This dish's lines; the same array until they change. */
  dishLines: (slug: string) => readonly CartLine[];
}

const NO_LINES: readonly CartLine[] = Object.freeze([]);

const sameLines = (a: readonly CartLine[], b: readonly CartLine[]) =>
  a.length === b.length && a.every((line, i) => line === b[i]);

function createCartStore(): CartStore {
  let state: StoreState = { cart: EMPTY_CART, sessionId: null };
  const listeners = new Set<() => void>();
  const dishCache = new Map<string, { from: CartLine[]; lines: readonly CartLine[] }>();

  const update = (cart: CartState, sessionId: string | null) => {
    if (cart === state.cart && sessionId === state.sessionId) return;
    state = { cart, sessionId };
    listeners.forEach((l) => l());
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch: (action) => update(cartReducer(state.cart, action), state.sessionId),
    hydrate: (sessionId, cart) =>
      update(cartReducer(state.cart, { type: 'hydrate', state: cart }), sessionId),
    dishLines(slug) {
      const all = state.cart.lines;
      const cached = dishCache.get(slug);
      if (cached?.from === all) return cached.lines;
      const found = all.filter((l) => l.dishSlug === slug);
      // Keep the previous array when another dish changed, so this one doesn't re-render.
      const lines =
        found.length === 0
          ? NO_LINES
          : cached && sameLines(cached.lines, found)
            ? cached.lines
            : found;
      dishCache.set(slug, { from: all, lines });
      return lines;
    },
  };
}

/** Re-prices saved lines against the current menu and drops dishes that no longer exist. */
function reconcile(saved: CartState, menu: MenuCatalog): CartState {
  const lines = saved.lines.flatMap((line) => {
    const dish = menu.getDish(line.dishSlug);
    if (!dish) return [];
    const config = normaliseConfig(dish, line);
    return [{ ...line, ...config, key: lineKey(config), unitPrice: unitPrice(dish, config) }];
  });
  return { kitchenNote: saved.kitchenNote, lines };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** The saved cart if it belongs to this guest session; another session's cart is discarded. */
function readSavedCart(menu: MenuCatalog, sessionId: string): CartState {
  const saved = readJSON(STORAGE_KEYS.cart, isObject);
  const cart = saved?.sessionId === sessionId ? parseCart(saved) : null;
  return cart ? reconcile(cart, menu) : EMPTY_CART;
}

function createActions(
  store: CartStore,
  showToast: ReturnType<typeof useToast>['showToast'],
  menu: MenuCatalog,
  t: Translator<ContentMap['cart']>,
): CartActions {
  const { dispatch } = store;
  const quantityOf = (key: string) =>
    store.getState().cart.lines.find((l) => l.key === key)?.quantity ?? 0;

  const removeLine = (key: string) => {
    const lines = store.getState().cart.lines;
    const index = lines.findIndex((l) => l.key === key);
    const line = lines[index];
    if (!line) return;
    dispatch({ type: 'remove', key });
    const dishName = menu.getDish(line.dishSlug)?.name ?? t('toast.unknownItem');
    showToast(t('toast.removed', { dish: dishName }), {
      actionLabel: t('toast.undo'),
      onAction: () => dispatch({ type: 'restore', line, index }),
    });
  };

  return {
    removeLine,
    setQuantity(key, quantity) {
      if (quantity <= 0) removeLine(key);
      else dispatch({ type: 'setQuantity', key, quantity });
    },
    addItem(dish, config, quantity = 1, options = {}) {
      const key = lineKey(config);
      const before = quantityOf(key);
      dispatch({ type: 'add', config, unitPrice: unitPrice(dish, config), quantity });
      const added = quantityOf(key) - before;
      if (options.toast === false) return;
      showToast(t('toast.added', { dish: dish.name }), {
        actionLabel: t('toast.undo'),
        // Take back only what this add put in, even if the quantity changed since.
        onAction: () => {
          const now = quantityOf(key);
          if (now === 0) return;
          if (now <= added) dispatch({ type: 'remove', key });
          else dispatch({ type: 'setQuantity', key, quantity: now - added });
        },
      });
    },
    editLine(key, dish, config, quantity) {
      dispatch({ type: 'edit', key, config, unitPrice: unitPrice(dish, config), quantity });
    },
    setKitchenNote: (note) => dispatch({ type: 'setKitchenNote', note }),
    clear: () => dispatch({ type: 'clear' }),
  };
}

const CartContext = createContext<CartContextValue | null>(null);
const CartStoreContext = createContext<{ store: CartStore; actions: CartActions } | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const menu = useMenu();
  const t = useContent('cart');
  const [store] = useState(createCartStore);
  const actions = useMemo(
    () => createActions(store, showToast, menu, t),
    [store, showToast, menu, t],
  );
  const { cart, sessionId } = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const hydrated = sessionId !== null;
  const guestId = useGuestSession()?.id;

  // Read the saved cart once the guest session is known (after mount, so server HTML and
  // the first client render match), and again whenever the session changes.
  useEffect(() => {
    if (guestId) store.hydrate(guestId, readSavedCart(menu, guestId));
  }, [store, menu, guestId]);

  useEffect(() => {
    if (sessionId) writeJSON(STORAGE_KEYS.cart, { sessionId, ...cart });
  }, [cart, sessionId]);

  // Keep carts in sync across tabs on the same device.
  useEffect(() => {
    if (!guestId) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.cart) store.hydrate(guestId, readSavedCart(menu, guestId));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [store, menu, guestId]);

  const storeValue = useMemo(() => ({ store, actions }), [store, actions]);

  const value = useMemo<CartContextValue>(() => {
    const bill = calculateBill(cart.lines);
    return {
      lines: cart.lines,
      kitchenNote: cart.kitchenNote,
      bill,
      count: bill.itemCount,
      hydrated,
      ...actions,
      linesForDish: (slug) => cart.lines.filter((l) => l.dishSlug === slug),
    };
  }, [cart, hydrated, actions]);

  return (
    <CartStoreContext.Provider value={storeValue}>
      <CartContext.Provider value={value}>{children}</CartContext.Provider>
    </CartStoreContext.Provider>
  );
}

/** The whole cart. Re-renders on every cart change — prefer the narrower hooks below. */
export function useCartContext(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

function useCartStore() {
  const ctx = useContext(CartStoreContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

/** Cart actions only. Never re-renders on cart changes. */
export function useCartActions(): CartActions {
  return useCartStore().actions;
}

/** One dish's cart lines; re-renders only when they change. Empty until the cart is hydrated. */
export function useDishLines(slug: string): readonly CartLine[] {
  const { store } = useCartStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.dishLines(slug),
    () => NO_LINES,
  );
}

/** Total quantity of one dish across its cart lines. */
export function useDishQuantity(slug: string): number {
  const { store } = useCartStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.dishLines(slug).reduce((n, l) => n + l.quantity, 0),
    () => 0,
  );
}
