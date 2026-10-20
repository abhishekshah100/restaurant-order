import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { VerifyStep } from '@/components/checkout/VerifyStep';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('checkout');
  return { title: t('meta.verify.title'), description: t('meta.verify.description') };
}

export default function Page() {
  return <VerifyStep />;
}
