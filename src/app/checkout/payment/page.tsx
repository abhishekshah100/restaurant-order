import type { Metadata } from 'next';
import { PaymentStep } from '@/components/checkout/PaymentStep';

export const metadata: Metadata = {
  title: 'Payment',
  description: 'Pay online now or at the counter.',
};

export default function Page() {
  return <PaymentStep />;
}
