'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CartAction, CartLine, CartState, LineConfig } from '@/types/cart';
import type { Dish } from '@/types/menu';
import { useBranch, useContent, useMenuIfNeeded } from '@/api/hooks';
import { branchMenuQuery, type ContentMap } from '@/api/queries';
import type { Translator } from '@/api/translator';
import type { MenuCatalog } from '@/lib/menu';
import { calculateBill, type Bill } from '@/lib/pricing';
import { lineKey, unitPrice } from '@/lib/cartLine';
import type { ReorderLine } from '@/lib/lifecycle';
import { normaliseConfig } from '@/lib/options';
import { EMPTY_CART, cartReducer, parseCart } from '@/lib/cartReducer';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';
import { useGuestSession } from './GuestSessionContext';
import { DESKTOP_QUERY, matchesNow } from '@/hooks/useMediaQuery';
import { useToast } from './ToastContext';

/** How long "Paneer Tikka added" shows: on the cart bar, or as a toast without one. */
export const ADDED_FLASH_MS = 1500;
const ADDED_TOAST_MS = 2000;

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
  /** Keeps a promo code the server accepted with the cart; undefined removes it. */
  setPromoCode: (code: string | undefined) => void;
  clear: () => void;
  /**
   * Fills the cart with an order's latest round to change it ("Editing order #A105"); the cart
   * as it was is put back by `stopEditing`.
   */
  startEditing: (
    target: { orderId: string; round: number },
    lines: readonly ReorderLine[],
    kitchenNote: string,
  ) => void;
  /** Ends editing: the cart goes back to what it held before. */
  stopEditing: () => void;
}

export interface CartContextValue extends CartActions {
  lines: CartLine[];
  kitchenNote: string;
  /** The promo code the guest applied, if any (see useOrderBill for what it takes off). */
  promoCode: string | undefined;
  /** The order (round) being changed, while editing; null otherwise. */
  editing: { orderId: string; round: number } | null;
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
  /** Loads the guest session's saved cart (keeping anything added before the session was known). */
  hydrate: (sessionId: string, cart: CartState) => void;
  /** This dish's lines; the same array until they change. */
  dishLines: (slug: string) => readonly CartLine[];
  /** The dish just added, for the cart bar to show; its own listeners (cart ones don't wake). */
  added: () => AddedNote | null;
  announceAdded: (dish: string) => void;
  subscribeAdded: (listener: () => void) => () => void;
  /** A cart bar on screen to show adds, until the returned function (none: a toast says it). */
  showAddsHere: () => () => void;
  /** Whether a cart bar is on screen to show adds. */
  showsAdds: () => boolean;
}

/** A dish just added: its name, and when (a bar mounting just after still shows it). */
export interface AddedNote {
  dish: string;
  at: number;
}

const NO_LINES: readonly CartLine[] = Object.freeze([]);

const sameLines = (a: readonly CartLine[], b: readonly CartLine[]) =>
  a.length === b.length && a.every((line, i) => line === b[i]);

function createCartStore(): CartStore {
  let state: StoreState = { cart: EMPTY_CART, sessionId: null };
  const listeners = new Set<() => void>();
  const addedListeners = new Set<() => void>();
  let added: AddedNote | null = null;
  let addViews = 0;
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
    hydrate(sessionId, cart) {
      // Lines added while the guest's session was still opening are theirs: keep them.
      const early = state.sessionId === null ? state.cart.lines : [];
      const loaded = early.reduce(
        (next, line) => cartReducer(next, { type: 'restore', line, index: next.lines.length }),
        cartReducer(state.cart, { type: 'hydrate', state: cart }),
      );
      update(loaded, sessionId);
    },
    added: () => added,
    announceAdded(dish) {
      added = { dish, at: Date.now() };
      addedListeners.forEach((l) => l());
    },
    subscribeAdded(listener) {
      addedListeners.add(listener);
      return () => addedListeners.delete(listener);
    },
    showAddsHere() {
      addViews += 1;
      return () => {
        addViews -= 1;
      };
    },
    showsAdds: () => addViews > 0,
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

/** A cart line for a configuration, priced from the menu. */
const toCartLine = (dish: Dish, config: LineConfig, quantity: number): CartLine => ({
  ...config,
  key: lineKey(config),
  quantity,
  unitPrice: unitPrice(dish, config),
});

/** Re-prices saved lines against the current menu and drops dishes that no longer exist. */
function repriceLines(lines: readonly CartLine[], menu: MenuCatalog): CartLine[] {
  return lines.flatMap((line) => {
    const dish = menu.getDish(line.dishSlug);
    if (!dish) return [];
    return [{ ...line, ...toCartLine(dish, normaliseConfig(dish, line), line.quantity) }];
  });
}

/** Whether a cart has dishes to price: its own, or the ones put aside while editing an order. */
const hasDishes = (cart: CartState) =>
  cart.lines.length > 0 || (cart.editing?.stash.lines.length ?? 0) > 0;

/** A saved cart (and the one put aside while editing an order) on the current menu. */
function reconcile(saved: CartState, menu: MenuCatalog): CartState {
  const cart: CartState = {
    kitchenNote: saved.kitchenNote,
    lines: repriceLines(saved.lines, menu),
    ...(saved.promoCode ? { promoCode: saved.promoCode } : {}),
  };
  const { editing } = saved;
  if (!editing) return cart;
  const stash = { ...editing.stash, lines: repriceLines(editing.stash.lines, menu) };
  return { ...cart, editing: { ...editing, stash } };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * The saved cart if it belongs to this guest session (not yet on the current menu); another
 * session's cart is discarded.
 */
function readSavedCart(sessionId: string): CartState {
  const saved = readJSON(STORAGE_KEYS.cart, isObject);
  return (saved?.sessionId === sessionId ? parseCart(saved) : null) ?? EMPTY_CART;
}

function createActions(
  store: CartStore,
  showToast: ReturnType<typeof useToast>['showToast'],
  menu: MenuCatalog | null,
  t: Translator<ContentMap['cart']>,
): CartActions {
  const { dispatch } = store;

  const removeLine = (key: string) => {
    const lines = store.getState().cart.lines;
    const index = lines.findIndex((l) => l.key === key);
    const line = lines[index];
    if (!line) return;
    dispatch({ type: 'remove', key });
    const dishName = menu?.getDish(line.dishSlug)?.name ?? t('toast.unknownItem');
    showToast(t('toast.removed', { dish: dishName }), {
      icon: 'trash',
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
      dispatch({ type: 'add', config, unitPrice: unitPrice(dish, config), quantity });
      // The cart bar says it (and stays out of the way); the stepper that replaced ADD takes it
      // back. Without a bar on screen (desktop, the cart page), a short toast says it instead.
      store.announceAdded(dish.name);
      if (options.toast === false) return;
      const barShowsIt = store.showsAdds() && !matchesNow(DESKTOP_QUERY);
      if (!barShowsIt) {
        showToast(t('toast.added', { dish: dish.name }), { duration: ADDED_TOAST_MS });
      }
    },
    editLine(key, dish, config, quantity) {
      dispatch({ type: 'edit', key, config, unitPrice: unitPrice(dish, config), quantity });
    },
    setKitchenNote: (note) => dispatch({ type: 'setKitchenNote', note }),
    setPromoCode: (code) => dispatch({ type: 'setPromoCode', code }),
    clear: () => dispatch({ type: 'clear' }),
    startEditing({ orderId, round }, lines, kitchenNote) {
      // Same configuration twice (two items alike) is one line, as in the cart.
      const cart = lines.reduce(
        (next, { dish, config, quantity }) =>
          cartReducer(next, { type: 'add', config, unitPrice: unitPrice(dish, config), quantity }),
        EMPTY_CART,
      );
      dispatch({ type: 'startEditing', orderId, round, lines: cart.lines, kitchenNote });
    },
    stopEditing: () => dispatch({ type: 'stopEditing' }),
  };
}

const CartContext = createContext<CartContextValue | null>(null);
const CartStoreContext = createContext<{ store: CartStore; actions: CartActions } | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const guestId = useGuestSession()?.id;
  // The menu only re-prices a saved cart with dishes in it: an empty one (a fresh scan) needs
  // none, so the page doesn't wait for or download it. Pages that add dishes have read it.
  const savedDishes = useMemo(
    () => (guestId ? hasDishes(readSavedCart(guestId)) : false),
    [guestId],
  );
  const menu = useMenuIfNeeded(savedDishes);
  const t = useContent('cart');
  const branch = useBranch();
  const [store] = useState(createCartStore);
  const actions = useMemo(
    () => createActions(store, showToast, menu, t),
    [store, showToast, menu, t],
  );
  const { cart, sessionId } = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const hydrated = sessionId !== null;

  /** The saved cart on the current menu; one with dishes waits for the menu (read here). */
  const queryClient = useQueryClient();
  const restore = useCallback(
    (id: string) => {
      const saved = readSavedCart(id);
      if (!hasDishes(saved)) store.hydrate(id, saved);
      else if (menu) store.hydrate(id, reconcile(saved, menu));
      // Restored again once it's in (`menu` changes).
      else void queryClient.prefetchQuery(branchMenuQuery(branch.id));
    },
    [store, menu, queryClient, branch.id],
  );

  // Read the saved cart once the guest session is known (after mount, so server HTML and
  // the first client render match), and again whenever the session changes.
  useEffect(() => {
    if (guestId) restore(guestId);
  }, [restore, guestId]);

  useEffect(() => {
    if (sessionId) writeJSON(STORAGE_KEYS.cart, { sessionId, ...cart });
  }, [cart, sessionId]);

  // Keep carts in sync across tabs on the same device.
  useEffect(() => {
    if (!guestId) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.cart) restore(guestId);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [restore, guestId]);

  const storeValue = useMemo(() => ({ store, actions }), [store, actions]);

  const value = useMemo<CartContextValue>(() => {
    const bill = calculateBill(cart.lines, branch);
    return {
      lines: cart.lines,
      kitchenNote: cart.kitchenNote,
      promoCode: cart.promoCode,
      editing: cart.editing ? { orderId: cart.editing.orderId, round: cart.editing.round } : null,
      bill,
      count: bill.itemCount,
      hydrated,
      ...actions,
      linesForDish: (slug) => cart.lines.filter((l) => l.dishSlug === slug),
    };
  }, [cart, hydrated, actions, branch]);

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

/**
 * The dish just added ("Paneer Tikka"), for ADDED_FLASH_MS after the add, then null. Counts the
 * caller as a cart bar on screen while mounted, so adds show there instead of as a toast.
 */
export function useAddedFlash(): AddedNote | null {
  const { store } = useCartStore();
  const note = useSyncExternalStore(store.subscribeAdded, store.added, () => null);
  // The add whose moment has passed; one from before this bar mounted counts as passed, unless
  // it was just now (added on a dish's page, back on the menu).
  const [doneAt, setDoneAt] = useState(() => {
    const first = store.added();
    return first && Date.now() - first.at >= ADDED_FLASH_MS ? first.at : null;
  });

  useEffect(() => store.showAddsHere(), [store]);

  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(
      () => setDoneAt(note.at),
      Math.max(0, note.at + ADDED_FLASH_MS - Date.now()),
    );
    return () => window.clearTimeout(id);
  }, [note]);

  return note && doneAt !== note.at ? note : null;
}
