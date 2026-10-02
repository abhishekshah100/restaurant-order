import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryView } from '@/components/menu/CategoryView';
import { categories } from '@/data/menu';
import { getCategory } from '@/lib/menu';

interface Props {
  params: Promise<{ category: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = getCategory((await params).category);
  return category
    ? { title: category.name, description: `${category.name} — ${category.description}.` }
    : {};
}

export default async function CategoryPage({ params }: Props) {
  const category = getCategory((await params).category);
  if (!category) notFound();
  return <CategoryView category={category} />;
}
