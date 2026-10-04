import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dehydrate, hydrate, QueryClient, type DehydratedState } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toOrderHistory } from '@/api/adapters';
import {
  CONTENT_NAMESPACES,
  branchMenuQuery,
  branchesQuery,
  helpQuery,
  orderHistoryQuery,
  restaurantQuery,
} from '@/api/queries';
import { QueryProvider } from '@/api/QueryProvider';
import { createStorageDb } from '@/api/mock/db';
import { HOUR_MS, TABLE_SESSION_HOURS } from '@/api/mock/rules';
import { querySeed } from '@/api/mock/seed';
import { createMockServer } from '@/api/mock/server';
import { AppProviders } from '@/context/AppProviders';
import { cartLineLabels } from '@/hooks/useCartLineLabels';
import { createTranslator } from '@/api/translator';
import type { ContentMap } from '@/api/queries';
import type { CartLineLabels } from '@/lib/cartLine';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { createMoney } from '@/lib/money';
import { resolveBranch } from '@/lib/scan';
import { STORAGE_KEYS } from '@/lib/storage';
import type { Branch } from '@/types/branch';
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

/** GET /branches, from the dummy JSON. */
export const testBranches = () => readApiJson<Branch[]>('branches');

/** One branch by id; the default branch (India) when none is given. */
export const testBranch = (id = testRestaurant().defaultBranchId): Branch =>
  resolveBranch(testBranches(), id);

/** The menu catalog over GET /branches/:id/menu (default branch), from the dummy JSON. */
export const testMenu = (branchId = testRestaurant().defaultBranchId): MenuCatalog =>
  createMenuCatalog(readApiJson<MenuData>(`branches/${branchId}/menu`));

/** GET /orders after the adapter, for the default branch, dated against `now`. */
export const testOrderHistory = (now?: Date): OrderHistory =>
  toOrderHistory(readApiJson<OrdersResponse>('orders'), testBranch(), now);

/**
 * Saves a live guest session on this device, as if a QR scan had opened it, and returns it.
 * (The mock server adopts the device's saved session, so the API accepts it.)
 */
export function seedGuestSession(over: Partial<GuestSession> = {}): GuestSession {
  const { id: branchId, defaultTable: table } = testBranch();
  const now = Date.now();
  const session: GuestSession = {
    id: `guest-${now}-${Math.random().toString(36).slice(2)}`,
    branchId,
    mode: 'dineIn',
    table,
    startedAt: now,
    expiresAt: now + TABLE_SESSION_HOURS * HOUR_MS,
    ...over,
  };
  window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  return session;
}

/** Cart-line description words, built from the cart content exactly as the app does. */
export const testLineLabels = (): CartLineLabels =>
  cartLineLabels(
    createTranslator(readApiJson<ContentMap['cart']>('content/cart')),
    createMoney(testBranch()),
  );

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
  const branches = testBranches();
  client.setQueryData(branchesQuery().queryKey, branches);
  for (const { id } of branches) {
    client.setQueryData(branchMenuQuery(id).queryKey, readApiJson<MenuData>(`branches/${id}/menu`));
  }
  client.setQueryData(orderHistoryQuery().queryKey, readApiJson<OrdersResponse>('orders'));
  client.setQueryData(helpQuery().queryKey, readApiJson<HelpTopics>('help'));
  return dehydrate(client);
}

/**
 * A mock server over this device's Web Storage, seeded with the dummy JSON, on a clock the
 * test controls (default: the real one) and with predictable ids (id-1, id-2…).
 */
export function createTestServer(now: () => number = () => Date.now()) {
  const client = new QueryClient();
  hydrate(client, createApiState());
  let count = 0;
  return createMockServer({
    db: createStorageDb(),
    seed: querySeed(client),
    now,
    newId: () => `id-${++count}`,
  });
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
