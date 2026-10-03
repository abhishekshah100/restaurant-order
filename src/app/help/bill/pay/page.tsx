import type { Metadata } from 'next';
import { getContent } from '@/api/server';
import { PayBillView } from '@/components/service/PayBillView';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('service');
  return { title: t('payBill.title'), description: t('payBill.description') };
}

export default function PayBillPage() {
  return <PayBillView />;
}
