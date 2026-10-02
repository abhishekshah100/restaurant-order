import type { Metadata } from 'next';
import { DetailsStep } from '@/components/checkout/DetailsStep';

export const metadata: Metadata = {
  title: 'Your details',
  description: 'Enter your name and mobile number to place your order.',
};

export default function Page() {
  return <DetailsStep />;
}
