import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Global CSS first, so component modules always come after it in the cascade.
import '@/styles/globals.css';
import { dehydrate } from '@tanstack/react-query';
import { makeQueryClient } from '@/api/queryClient';
import { getContent, prefetchAppData } from '@/api/server';
import { AppProviders } from '@/context/AppProviders';
import { fontVariables } from '@/fonts';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getContent('common');
  return {
    title: { default: t('meta.title'), template: t('meta.titleTemplate') },
    description: t('meta.description'),
    applicationName: t('meta.applicationName'),
    formatDetection: { telephone: false },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#F3E8D8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Fetch every endpoint once at build time; pages render with the data, the browser reuses it.
  const queryClient = makeQueryClient();
  await prefetchAppData(queryClient);
  const t = await getContent('common');
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <a className="skip-link" href="#main">
          {t('skipLink')}
        </a>
        <AppProviders state={dehydrate(queryClient)}>{children}</AppProviders>
      </body>
    </html>
  );
}
