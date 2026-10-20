import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { PaymentStep } from '@/components/checkout/PaymentStep';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('checkout');
  return { title: t('meta.payment.title'), description: t('meta.payment.description') };
}

export default function Page() {
  return <PaymentStep />;
}
