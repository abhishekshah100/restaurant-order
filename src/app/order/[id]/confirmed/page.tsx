import type { Metadata } from 'next';
import { OrderConfirmed } from '@/components/order/OrderConfirmed';
import { getContent, getOrderIdsServer } from '@/api/server';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getOrderIdsServer()).map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getContent('orders');
  return { title: t('meta.orderPlaced', { id: (await params).id }) };
}

export default async function OrderConfirmedPage({ params }: Props) {
  return <OrderConfirmed id={(await params).id} />;
}
