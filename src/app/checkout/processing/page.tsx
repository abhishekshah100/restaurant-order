import type { Metadata } from 'next';
import { ProcessingStep } from '@/components/checkout/ProcessingStep';

export const metadata: Metadata = {
  title: 'Confirming payment',
  description: 'Approve the payment request in your UPI app.',
};

export default function Page() {
  return <ProcessingStep />;
}
