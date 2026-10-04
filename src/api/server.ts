import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { QueryClient } from '@tanstack/react-query';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { resolveBranch } from '@/lib/scan';
import type { Branch } from '@/types/branch';
import type { HelpTopics } from '@/types/help';
import type { Category, Dish, MenuData } from '@/types/menu';
import type { OrdersResponse } from '@/types/order';
import type { Restaurant } from '@/types/restaurant';
import {
  CONTENT_NAMESPACES,
  branchMenuQuery,
  branchesQuery,
  contentQuery,
  helpQuery,
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

const readBranches = () => readApiFile<Branch[]>('branches');
const readMenu = (branchId: string) => readApiFile<MenuData>(`branches/${branchId}/menu`);

/**
 * Fills the query cache with everything the pages need, for the root layout to dehydrate.
 * Every branch's menu is included, so a page renders from the cache whichever branch the
 * guest's QR code is for.
 */
export async function prefetchAppData(client: QueryClient): Promise<void> {
  const branches = await readBranches();
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
    client.prefetchQuery({ ...branchesQuery(), queryFn: () => branches }),
    ...branches.map((b) =>
      client.prefetchQuery({ ...branchMenuQuery(b.id), queryFn: () => readMenu(b.id) }),
    ),
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

/** Every branch's menu, the default branch's first. */
async function getMenusServer(): Promise<MenuCatalog[]> {
  const [branches, { defaultBranchId }] = await Promise.all([
    readBranches(),
    readApiFile<Restaurant>('restaurant'),
  ]);
  const first = resolveBranch(branches, defaultBranchId);
  const ordered = [first, ...branches.filter((b) => b !== first)];
  return Promise.all(ordered.map(async (b) => createMenuCatalog(await readMenu(b.id))));
}

/** Every dish slug on any branch's menu (generateStaticParams for /dish/[slug]). */
export async function getDishSlugsServer(): Promise<string[]> {
  const menus = await getMenusServer();
  return [...new Set(menus.flatMap((m) => m.dishes.map((d) => d.slug)))];
}

/** Every category on any branch's menu (generateStaticParams for /menu/[category]). */
export async function getCategoryIdsServer(): Promise<string[]> {
  const menus = await getMenusServer();
  return [...new Set(menus.flatMap((m) => m.categories.map((c) => c.id)))];
}

/** A dish for page metadata: as the default branch has it, else the first branch that does. */
export async function getDishServer(slug: string): Promise<Dish | undefined> {
  return (await getMenusServer()).map((m) => m.getDish(slug)).find(Boolean);
}

/** A category for page metadata: as the default branch has it, else the first branch that does. */
export async function getCategoryServer(id: string): Promise<Category | undefined> {
  return (await getMenusServer()).map((m) => m.getCategory(id)).find(Boolean);
}

/** Every order page to pre-render: the order history plus the pool for new orders. */
export async function getOrderIdsServer(): Promise<string[]> {
  const { history, newOrderIds } = await readApiFile<OrdersResponse>('orders');
  return [...history.map((o) => o.id), ...newOrderIds];
}
