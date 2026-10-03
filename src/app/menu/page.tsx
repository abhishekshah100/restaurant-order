import type { Metadata } from 'next';
import { MenuHome } from '@/components/menu/MenuHome';
import { getContent } from '@/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('menu');
  return { title: t('nav.menu'), description: t('meta.menuDescription') };
}

export default function MenuPage() {
  return <MenuHome />;
}
