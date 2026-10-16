import type { Metadata } from 'next';
import { getContent } from '@/api/server';

type KitchenPage = 'board' | 'stock' | 'activity';

/** A kitchen page's title (kitchen › meta); staff pages are never indexed. */
export async function kitchenMetadata(page: KitchenPage): Promise<Metadata> {
  const t = await getContent('kitchen');
  return { title: t(`meta.${page}`), robots: { index: false, follow: false } };
}
