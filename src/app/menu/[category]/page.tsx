import type { Metadata } from 'next';
import { CategoryView } from '@/components/menu/CategoryView';
import { getCategoryIdsServer, getCategoryServer, getContent } from '@/api/server';

interface Props {
  params: Promise<{ category: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getCategoryIdsServer()).map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategoryServer((await params).category);
  if (!category) return {};
  const t = await getContent('menu');
  return {
    title: category.name,
    description: t('meta.categoryDescription', {
      name: category.name,
      description: category.description,
    }),
  };
}

/** The category's dishes come from the guest's branch menu on the client. */
export default async function CategoryPage({ params }: Props) {
  return <CategoryView categoryId={(await params).category} />;
}
