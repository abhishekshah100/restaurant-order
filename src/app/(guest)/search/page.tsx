import type { Metadata } from 'next';
import { SearchView } from '@/components/menu/SearchView';
import { getContent } from '@/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('menu');
  return { title: t('nav.search'), description: t('meta.searchDescription') };
}

export default function SearchPage() {
  return <SearchView />;
}
