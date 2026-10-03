'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Order } from '@/types/order';
import type { BillPaymentMethod } from '@/types/service';
import { useContent, useMenu, useNewOrderIds, useRestaurant } from '@/api/hooks';
import { useCartLineLabels } from '@/hooks/useCartLineLabels';
import { MOCK_TRANSACTION_REF } from '@/lib/constants';
import {
  buildOrder,
  isOrder,
  markOrdersPaid,
  nextOrderId,
  type PlaceOrderInput,
} from '@/lib/orders';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/lib/storage';

interface State {
  placed: Order[];
  hydrated: boolean;
}

const isOrderList = (v: unknown): v is Order[] => Array.isArray(v) && v.every(isOrder);

const readPlaced = () => readJSON(STORAGE_KEYS.orders, isOrderList) ?? [];

/** Stored orders plus any only held in memory (storage blocked), newest first. */
function merge(stored: Order[], memory: Order[]): Order[] {
  const ids = new Set(stored.map((o) => o.id));
  return [...stored, ...memory.filter((o) => !ids.has(o.id))].sort((a, b) =>
    b.placedAt.localeCompare(a.placedAt),
  );
}

interface OrdersContextValue {
  /** Orders placed in this browser, newest first. */
  placed: Order[];
  hydrated: boolean;
  /** Null when the cart is empty or the order-id pool is used up. */
  placeOrder: (input: Omit<PlaceOrderInput, 'id'>) => Order | null;
  /**
   * Records an online payment for these orders placed on this device (a guest paying their own
   * bill). Only unpaid ones change; returns the orders it marked paid (empty if none were due).
   */
  markPaid: (orderIds: readonly string[], method: BillPaymentMethod) => Order[];
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

/**
 * Storage is the source of truth: the list is re-read on load, before every new
 * order or payment and whenever another tab changes it, so tabs never overwrite each other.
 */
export function OrdersProvider({ children }: { children: ReactNode }) {
  const menu = useMenu();
  const newOrderIds = useNewOrderIds();
  const t = useContent('orders');
  const restaurant = useRestaurant();
  const lineLabels = useCartLineLabels();
  const [state, setState] = useState<State>({ placed: [], hydrated: false });
  const placedRef = useRef<Order[]>([]);

  const update = useCallback((placed: Order[]) => {
    placedRef.current = placed;
    setState({ placed, hydrated: true });
  }, []);

  useEffect(() => {
    const sync = () => update(readPlaced());
    sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.orders) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [update]);

  const placeOrder = useCallback(
    (input: Omit<PlaceOrderInput, 'id'>) => {
      const placed = merge(readPlaced(), placedRef.current);
      const id = nextOrderId(placed, newOrderIds);
      if (!id) return null;
      const order = buildOrder({ ...input, id }, menu, {
        paidOnline: t('payment.paidOnline'),
        payAtCounter: t('payment.payAtCounter'),
        upi: t('payment.methodUpi'),
        lineLabels,
        estimate: restaurant.prepTime,
      });
      if (!order) return null;
      const next = [order, ...placed];
      // Persist immediately: the next screen reads it before this provider re-renders.
      writeJSON(STORAGE_KEYS.orders, next);
      update(next);
      return order;
    },
    [update, newOrderIds, menu, t, lineLabels, restaurant.prepTime],
  );

  const markPaid = useCallback(
    (orderIds: readonly string[], method: BillPaymentMethod) => {
      const { orders, marked } = markOrdersPaid(merge(readPlaced(), placedRef.current), orderIds, {
        detail: method === 'upi' ? t('payment.methodUpi') : t('payment.methodCard'),
        transactionRef: MOCK_TRANSACTION_REF,
      });
      if (marked.length > 0) {
        writeJSON(STORAGE_KEYS.orders, orders);
        update(orders);
      }
      return marked;
    },
    [update, t],
  );

  const value = useMemo(
    () => ({ placed: state.placed, hydrated: state.hydrated, placeOrder, markPaid }),
    [state, placeOrder, markPaid],
  );
  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used inside <OrdersProvider>');
  return ctx;
}
