import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { ProcessingStep } from '@/components/checkout/ProcessingStep';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('checkout');
  return { title: t('meta.processing.title'), description: t('meta.processing.description') };
}

export default function Page() {
  return <ProcessingStep />;
}
