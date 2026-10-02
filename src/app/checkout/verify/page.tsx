import type { Metadata } from 'next';
import { VerifyStep } from '@/components/checkout/VerifyStep';

export const metadata: Metadata = {
  title: 'Verify your number',
  description: 'Enter the 6-digit code we sent by SMS.',
};

export default function Page() {
  return <VerifyStep />;
}
