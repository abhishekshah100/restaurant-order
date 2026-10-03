import type { Metadata } from 'next';
import { Welcome } from '@/components/home/Welcome';
import { OrderingGate } from '@/components/status/OrderingGate';
import { getContent } from '@/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('home');
  return { title: { absolute: t('meta.title') }, description: t('meta.description') };
}

export default function WelcomePage() {
  // Closed, paused or offline: the restaurant-state screen replaces the welcome (s01–s03).
  return (
    <OrderingGate>
      <Welcome />
    </OrderingGate>
  );
}
