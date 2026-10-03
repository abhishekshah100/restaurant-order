import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { MyOrders } from '@/components/order/MyOrders';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('orders');
  return { title: t('shared.myOrders') };
}

export default function OrdersPage() {
  return <MyOrders />;
}
