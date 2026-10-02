import type { Metadata } from 'next';
import { ComingSoon } from '@/components/layout/ComingSoon';
import { ALL_ORDER_IDS } from '@/data/orders';

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_ORDER_IDS.map((id) => ({ id }));
}

export const metadata: Metadata = { title: 'Order details' };

export default function Page() {
  return <ComingSoon title="Order details" />;
}
