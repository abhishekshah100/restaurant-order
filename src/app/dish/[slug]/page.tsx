import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DishDetail } from '@/components/menu/DishDetail';
import { dishes } from '@/data/menu';
import { getDish } from '@/lib/menu';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return dishes.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dish = getDish((await params).slug);
  if (!dish) return {};
  return {
    title: dish.name,
    description: dish.longDescription ?? dish.description,
    openGraph: dish.image ? { images: [dish.image.src] } : undefined,
  };
}

export default async function DishPage({ params }: Props) {
  const dish = getDish((await params).slug);
  if (!dish) notFound();
  return <DishDetail dish={dish} />;
}
