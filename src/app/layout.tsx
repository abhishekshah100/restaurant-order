import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppProviders } from '@/context/AppProviders';
import { fontVariables } from '@/fonts';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'The Olive Table — Order from your table',
    template: '%s · The Olive Table',
  },
  description:
    'Browse the menu and order directly from your table at The Olive Table. Seasonal Indian and Mediterranean plates, cooked to order.',
  applicationName: 'The Olive Table',
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#F7F2EA',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
