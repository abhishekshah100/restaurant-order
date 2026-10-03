import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { BillRequested } from '@/components/service/BillRequested';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('service');
  return { title: t('shared.billRequested') };
}

export default function BillRequestedPage() {
  return <BillRequested />;
}
