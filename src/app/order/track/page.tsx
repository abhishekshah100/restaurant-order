import type { Metadata } from 'next';
import { OrderTracking } from '@/components/order/OrderTracking';
import { getContent } from '@/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('orders');
  return { title: t('meta.tracking') };
}

/** `/order/track/?id=A105`: the id is read on the client, so any id the API returns opens here. */
export default function OrderTrackingPage() {
  return <OrderTracking />;
}
