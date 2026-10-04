import type { Metadata } from 'next';
import { Home } from '@/components/home/Home';
import { getContent } from '@/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('home');
  return { title: { absolute: t('meta.title') }, description: t('meta.description') };
}

export default function WelcomePage() {
  // The start screen without a QR code; closed, paused or offline: the restaurant-state screen (s01–s03).
  return <Home />;
}
