import type { Metadata } from 'next';
import { DishPage } from '@/components/menu/DishPage';
import { getContent } from '@/api/server';
import { BranchStatusWatch } from '@/components/status/BranchStatusWatch';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('menu');
  return { title: t('nav.menu'), description: t('meta.menuDescription') };
}

/** `/dish/?slug=paneer-tikka`: one page for every dish, read from the live menu (lib/menu › dishHref). */
export default function DishRoute() {
  return (
    <>
      <DishPage />
      <BranchStatusWatch />
    </>
  );
}
