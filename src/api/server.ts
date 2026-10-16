import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { QueryClient } from '@tanstack/react-query';
import { createMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { resolveBranch } from '@/lib/scan';
import type { Branch } from '@/types/branch';
import type { HelpTopics } from '@/types/help';
import type { Category, Dish, MenuData } from '@/types/menu';
import type { BranchPromotions } from '@/types/promotion';
import type { Restaurant } from '@/types/restaurant';
import {
  CONTENT_NAMESPACES,
  branchMenuQuery,
  branchPromotionsQuery,
  branchesQuery,
  contentQuery,
  helpQuery,
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
 * Fills the query cache with what every page needs, for the root layout to dehydrate: the copy,
 * the brand, the branches, and the default branch's menu and promotions. It's built into every
 * page, so it stays small: another branch's menu is read in the browser when a guest's session
 * is there (GuestSessionProvider waits for it), and data for a single screen is prefetched by
 * that screen's layout (help) or read on demand (the admin's order history).
 */
export async function prefetchAppData(client: QueryClient): Promise<void> {
  const [branches, restaurant] = await Promise.all([
    readBranches(),
    readApiFile<Restaurant>('restaurant'),
  ]);
  const { id: branchId } = resolveBranch(branches, restaurant.defaultBranchId);
  client.setQueryData(restaurantQuery().queryKey, restaurant);
  // Already out of date in the page, like the menu: the browser reads the live status once.
  client.setQueryData(branchesQuery().queryKey, branches, { updatedAt: 0 });
  await Promise.all([
    ...CONTENT_NAMESPACES.map((ns) =>
      client.prefetchQuery({
        ...contentQuery(ns),
        queryFn: () => readApiFile<ContentMap[typeof ns]>(`content/${ns}`),
      }),
    ),
    // Built into the page as already out of date: staff change the menu during service (sold
    // out, back on), so the browser reads the live one once the page opens.
    readMenu(branchId).then((menu) =>
      client.setQueryData(branchMenuQuery(branchId).queryKey, menu, { updatedAt: 0 }),
    ),
    client.prefetchQuery({
      ...branchPromotionsQuery(branchId),
      queryFn: () => readApiFile<BranchPromotions>(`branches/${branchId}/promotions`),
    }),
  ]);
}

/** Fills the query cache with the Help topics, for the help pages' layout to dehydrate. */
export async function prefetchHelp(client: QueryClient): Promise<void> {
  await client.prefetchQuery({ ...helpQuery(), queryFn: () => readApiFile<HelpTopics>('help') });
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
