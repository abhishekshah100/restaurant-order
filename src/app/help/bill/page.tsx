import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { BillRequestView } from '@/components/service/BillRequestView';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('service');
  return { title: t('shared.requestTheBill') };
}

export default function BillRequestPage() {
  return <BillRequestView />;
}
