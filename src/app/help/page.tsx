import type { Metadata } from 'next';
import { ComingSoon } from '@/components/layout/ComingSoon';

export const metadata: Metadata = { title: 'Service and help' };

export default function HelpPage() {
  return <ComingSoon title="How can we help?" />;
}
