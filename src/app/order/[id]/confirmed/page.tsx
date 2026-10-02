import type { Metadata } from 'next';
import { OrderConfirmed } from '@/components/order/OrderConfirmed';
import { ALL_ORDER_IDS } from '@/data/orders';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_ORDER_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order #${(await params).id} placed` };
}

export default async function OrderConfirmedPage({ params }: Props) {
  return <OrderConfirmed id={(await params).id} />;
}
