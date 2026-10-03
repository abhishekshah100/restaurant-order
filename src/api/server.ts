import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { QueryClient } from '@tanstack/react-query';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import type { HelpTopics } from '@/types/help';
import type { MenuData } from '@/types/menu';
import type { OrdersResponse } from '@/types/order';
import type { Restaurant } from '@/types/restaurant';
import {
  CONTENT_NAMESPACES,
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
 * Build-time data access. The static export has no server at runtime, so server components
 * (layouts, generateStaticParams, generateMetadata) read the same dummy JSON the browser
 * fetches. With a real backend, swap readApiFile for apiGet.
 */

/** Reads public/api/<endpoint>.json. */
export async function readApiFile<T>(endpoint: string): Promise<T> {
  const file = path.join(process.cwd(), 'public', 'api', `${endpoint}.json`);
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

/** Fills the query cache with everything the pages need, for the root layout to dehydrate. */
export async function prefetchAppData(client: QueryClient): Promise<void> {
  await Promise.all([
    ...CONTENT_NAMESPACES.map((ns) =>
      client.prefetchQuery({
        ...contentQuery(ns),
        queryFn: () => readApiFile<ContentMap[typeof ns]>(`content/${ns}`),
      }),
    ),
    client.prefetchQuery({
      ...restaurantQuery(),
      queryFn: () => readApiFile<Restaurant>('restaurant'),
    }),
    client.prefetchQuery({ ...menuQuery(), queryFn: () => readApiFile<MenuData>('menu') }),
    // The raw response, like the browser's fetch: the query's `select` adapts it on read.
    client.prefetchQuery({
      ...orderHistoryQuery(),
      queryFn: () => readApiFile<OrdersResponse>('orders'),
    }),
    client.prefetchQuery({ ...helpQuery(), queryFn: () => readApiFile<HelpTopics>('help') }),
  ]);
}

/** Copy for server code (metadata): `const t = await getContent('orders')`. */
export async function getContent<N extends ContentNamespace>(
  ns: N,
): Promise<Translator<ContentMap[N]>> {
  const dict: ContentMap[N] = await readApiFile(`content/${ns}`);
  return createTranslator(dict);
}

/** The menu for pages: generateStaticParams, generateMetadata and the page body. */
export async function getMenuServer(): Promise<MenuCatalog> {
  return createMenuCatalog(await readApiFile<MenuData>('menu'));
}

/** Every order page to pre-render: the order history plus the pool for new orders. */
export async function getOrderIdsServer(): Promise<string[]> {
  const { history, newOrderIds } = await readApiFile<OrdersResponse>('orders');
  return [...history.map((o) => o.id), ...newOrderIds];
}
