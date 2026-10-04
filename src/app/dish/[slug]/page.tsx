import type { Metadata } from 'next';
import { DishDetail } from '@/components/menu/DishDetail';
import { getDishServer, getDishSlugsServer } from '@/api/server';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getDishSlugsServer()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dish = await getDishServer((await params).slug);
  if (!dish) return {};
  return {
    title: dish.name,
    description: dish.longDescription ?? dish.description,
    openGraph: dish.image ? { images: [dish.image.src] } : undefined,
  };
}

/** The dish comes from the guest's branch menu on the client (prices differ by branch). */
export default async function DishPage({ params }: Props) {
  return <DishDetail slug={(await params).slug} />;
}
