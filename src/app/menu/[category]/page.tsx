import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryView } from '@/components/menu/CategoryView';
import { getContent, getMenuServer } from '@/api/server';

interface Props {
  params: Promise<{ category: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getMenuServer()).categories.map((c) => ({ category: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = (await getMenuServer()).getCategory((await params).category);
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

export default async function CategoryPage({ params }: Props) {
  const category = (await getMenuServer()).getCategory((await params).category);
  if (!category) notFound();
  return <CategoryView category={category} />;
}
