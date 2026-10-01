import type { Metadata } from 'next';
import { Styleguide } from './Styleguide';

export const metadata: Metadata = {
  title: 'Styleguide',
  description: 'Design tokens and UI components for The Olive Table ordering site.',
};

export default function StyleguidePage() {
  return <Styleguide />;
}
