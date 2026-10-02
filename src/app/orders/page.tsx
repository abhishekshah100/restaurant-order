import type { Metadata } from 'next';
import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata: Metadata = { title: 'My orders' };

export default function OrdersPage() {
  return <ComingSoon title="My orders" />;
}
