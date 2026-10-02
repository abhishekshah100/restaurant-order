import type { Metadata } from 'next';
import { Welcome } from '@/components/home/Welcome';

export const metadata: Metadata = {
  title: { absolute: 'The Olive Table — Welcome' },
  description: 'Browse the menu and order directly from your table. No app to download.',
};

export default function WelcomePage() {
  return <Welcome />;
}
