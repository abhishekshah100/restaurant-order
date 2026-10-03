import type { Metadata } from 'next';
import { OrderDetails } from '@/components/order/OrderDetails';
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
  return { title: t('shared.orderNumber', { id: (await params).id }) };
}

export default async function OrderDetailsPage({ params }: Props) {
  return <OrderDetails id={(await params).id} />;
}
