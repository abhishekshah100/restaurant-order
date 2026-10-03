import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dehydrate, QueryClient, type DehydratedState } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toOrderHistory } from '@/api/adapters';
import {
  CONTENT_NAMESPACES,
  helpQuery,
  menuQuery,
  orderHistoryQuery,
  restaurantQuery,
} from '@/api/queries';
import { QueryProvider } from '@/api/QueryProvider';
import { startGuestSession } from '@/api/session';
import { AppProviders } from '@/context/AppProviders';
import { cartLineLabels } from '@/hooks/useCartLineLabels';
import { createTranslator } from '@/api/translator';
import type { ContentMap } from '@/api/queries';
import type { CartLineLabels } from '@/lib/cartLine';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { STORAGE_KEYS } from '@/lib/storage';
import type { HelpTopics } from '@/types/help';
import type { MenuData } from '@/types/menu';
import type { OrderHistory, OrdersResponse } from '@/types/order';
import type { Restaurant } from '@/types/restaurant';
import type { GuestSession } from '@/types/session';

/** Reads public/api/<endpoint>.json synchronously (tests only). */
export function readApiJson<T>(endpoint: string): T {
  const file = path.join(process.cwd(), 'public', 'api', `${endpoint}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

/** GET /restaurant, from the dummy JSON. */
export const testRestaurant = () => readApiJson<Restaurant>('restaurant');

/** The menu catalog over GET /menu, from the dummy JSON. */
export const testMenu = (): MenuCatalog => createMenuCatalog(readApiJson<MenuData>('menu'));

/** GET /orders after the adapter, dated against `now`. */
export const testOrderHistory = (now?: Date): OrderHistory =>
  toOrderHistory(readApiJson<OrdersResponse>('orders'), now);

/** Saves a live guest session on this device (as a QR scan does) and returns it. */
export function seedGuestSession(over: Partial<GuestSession> = {}): GuestSession {
  const session = { ...startGuestSession({ table: testRestaurant().defaultTable }), ...over };
  window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  return session;
}

/** Cart-line description words, built from the cart content exactly as the app does. */
export const testLineLabels = (): CartLineLabels =>
  cartLineLabels(createTranslator(readApiJson<ContentMap['cart']>('content/cart')));

/**
 * The same cache the root layout builds at build time, from the dummy JSON, so components
 * under test read their data and copy without any network.
 */
export function createApiState(): DehydratedState {
  const client = new QueryClient();
  for (const ns of CONTENT_NAMESPACES) {
    // Plain key: each namespace has its own JSON shape, so the typed key can't be used in a loop.
    client.setQueryData(['content', ns], readApiJson<unknown>(`content/${ns}`));
  }
  client.setQueryData(restaurantQuery().queryKey, testRestaurant());
  client.setQueryData(menuQuery().queryKey, readApiJson<MenuData>('menu'));
  client.setQueryData(orderHistoryQuery().queryKey, readApiJson<OrdersResponse>('orders'));
  client.setQueryData(helpQuery().queryKey, readApiJson<HelpTopics>('help'));
  return dehydrate(client);
}

/** Wraps a component or hook under test in every app provider, with the API data loaded. */
export function TestProviders({ children }: { children: ReactNode }) {
  const [state] = useState(createApiState);
  return <AppProviders state={state}>{children}</AppProviders>;
}

/** Just the query cache with the API data loaded, for providers and hooks tested on their own. */
export function ApiTestProvider({ children }: { children: ReactNode }) {
  const [state] = useState(createApiState);
  return <QueryProvider state={state}>{children}</QueryProvider>;
}
