import type { Metadata } from 'next';
import { StartView } from '@/components/start/StartView';
import { getContent } from '@/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('home');
  return { title: t('start.meta.title'), description: t('start.meta.description') };
}

export default function StartPage() {
  return <StartView />;
}
