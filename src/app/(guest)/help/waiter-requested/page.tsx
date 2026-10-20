import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { WaiterRequested } from '@/components/service/WaiterRequested';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('service');
  return { title: t('meta.waiterRequested') };
}

export default function WaiterRequestedPage() {
  return <WaiterRequested />;
}
