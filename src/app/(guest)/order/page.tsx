import type { Metadata } from 'next';
import { OrderDetails } from '@/components/order/OrderDetails';
import { getContent } from '@/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('orders');
  return { title: t('meta.details') };
}

/** `/order/?id=A105`: the id is read on the client, so any id the API returns opens here. */
export default function OrderDetailsPage() {
  return <OrderDetails />;
}
