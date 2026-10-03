import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { DetailsStep } from '@/components/checkout/DetailsStep';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('checkout');
  return { title: t('meta.details.title'), description: t('meta.details.description') };
}

export default function Page() {
  return <DetailsStep />;
}
