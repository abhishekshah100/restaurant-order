import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DishDetail } from '@/components/menu/DishDetail';
import { getMenuServer } from '@/api/server';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getMenuServer()).dishes.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dish = (await getMenuServer()).getDish((await params).slug);
  if (!dish) return {};
  return {
    title: dish.name,
    description: dish.longDescription ?? dish.description,
    openGraph: dish.image ? { images: [dish.image.src] } : undefined,
  };
}

export default async function DishPage({ params }: Props) {
  const dish = (await getMenuServer()).getDish((await params).slug);
  if (!dish) notFound();
  return <DishDetail dish={dish} />;
}
