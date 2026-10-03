'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import type { HelpTopics } from '@/types/help';
import type { Order } from '@/types/order';
import type { Restaurant } from '@/types/restaurant';
import {
  contentQuery,
  helpQuery,
  menuQuery,
  orderHistoryQuery,
  restaurantQuery,
  type ContentMap,
  type ContentNamespace,
} from './queries';
import { createTranslator, type Translator } from './translator';

/*
 * The root layout prefetches every query at build time, so these hooks never wait on the
 * network in practice: they read the TanStack Query cache, and `data` is never undefined.
 */

/** Screen copy for one area: `const t = useContent('checkout'); t('verify.title')`. */
export function useContent<N extends ContentNamespace>(ns: N): Translator<ContentMap[N]> {
  const { data } = useSuspenseQuery(contentQuery(ns));
  return useMemo(() => createTranslator(data), [data]);
}

/** Restaurant profile, hours and live status. */
export function useRestaurant(): Restaurant {
  return useSuspenseQuery(restaurantQuery()).data;
}

/** The menu with its lookups (getDish, dishesIn, searchDishes…). The same object until the menu changes. */
export function useMenu(): MenuCatalog {
  const { data } = useSuspenseQuery(menuQuery());
  return useMemo(() => createMenuCatalog(data), [data]);
}

/** The guest's order history (orders already on the restaurant's books). */
export function useOrderHistory(): Order[] {
  return useSuspenseQuery(orderHistoryQuery()).data.history;
}

/** The pre-rendered id pool new orders are numbered from. */
export function useNewOrderIds(): string[] {
  return useSuspenseQuery(orderHistoryQuery()).data.newOrderIds;
}

/** The Help page topics, by id. */
export function useHelpTopics(): HelpTopics {
  return useSuspenseQuery(helpQuery()).data;
}
