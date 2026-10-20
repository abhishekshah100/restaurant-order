import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { HelpView } from '@/components/service/HelpView';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('service');
  return { title: t('meta.help') };
}

export default function HelpPage() {
  return <HelpView />;
}
