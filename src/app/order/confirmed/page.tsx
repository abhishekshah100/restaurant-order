import type { Metadata } from 'next';
import { OrderConfirmed } from '@/components/order/OrderConfirmed';
import { getContent } from '@/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('orders');
  return { title: t('meta.confirmed') };
}

/** `/order/confirmed/?id=A105`: the id is read on the client, so any id the API returns opens here. */
export default function OrderConfirmedPage() {
  return <OrderConfirmed />;
}
