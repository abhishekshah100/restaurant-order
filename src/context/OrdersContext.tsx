'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { Order } from '@/types/order';
import { buildOrder, isOrder, nextOrderId, type PlaceOrderInput } from '@/lib/orders';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';

interface State {
  placed: Order[];
  hydrated: boolean;
}

type Action = { type: 'hydrate'; placed: Order[] } | { type: 'add'; order: Order };

function reducer(state: State, action: Action): State {
  if (action.type === 'hydrate') return { placed: action.placed, hydrated: true };
  return { ...state, placed: [action.order, ...state.placed] };
}

const isOrderList = (v: unknown): v is Order[] => Array.isArray(v) && v.every(isOrder);

interface OrdersContextValue {
  /** Orders placed in this browser, newest first. */
  placed: Order[];
  hydrated: boolean;
  placeOrder: (input: Omit<PlaceOrderInput, 'id'>) => Order | null;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { placed: [], hydrated: false });

  useEffect(() => {
    dispatch({ type: 'hydrate', placed: readJSON(STORAGE_KEYS.orders, isOrderList) ?? [] });
  }, []);

  useEffect(() => {
    if (state.hydrated) writeJSON(STORAGE_KEYS.orders, state.placed);
  }, [state]);

  const placeOrder = useCallback(
    (input: Omit<PlaceOrderInput, 'id'>) => {
      const placed = readJSON(STORAGE_KEYS.orders, isOrderList) ?? state.placed;
      const id = nextOrderId(placed);
      if (!id) return null;
      const order = buildOrder({ ...input, id });
      // Persist immediately: the next screen reads it before this provider re-renders.
      writeJSON(STORAGE_KEYS.orders, [order, ...placed]);
      dispatch({ type: 'add', order });
      return order;
    },
    [state.placed],
  );

  const value = useMemo(
    () => ({ placed: state.placed, hydrated: state.hydrated, placeOrder }),
    [state, placeOrder],
  );
  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used inside <OrdersProvider>');
  return ctx;
}
