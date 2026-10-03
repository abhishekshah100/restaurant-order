import type { Metadata } from 'next';
import { OrderTracking } from '@/components/order/OrderTracking';
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
  return { title: t('tracking.heading', { id: (await params).id }) };
}

export default async function OrderTrackingPage({ params }: Props) {
  return <OrderTracking id={(await params).id} />;
}
