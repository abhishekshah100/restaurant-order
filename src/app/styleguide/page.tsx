import type { Metadata } from 'next';
import { Styleguide } from './Styleguide';

export const metadata: Metadata = {
  title: 'Styleguide',
  description: 'Design tokens and UI components for The Olive Table ordering site.',
  robots: { index: false, follow: false },
};

export default function StyleguidePage() {
  return <Styleguide />;
}
