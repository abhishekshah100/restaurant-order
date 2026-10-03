'use client';

import { useEffect } from 'react';
import { createTranslator } from '@/api/translator';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { fontVariables } from '@/fonts';
import '@/styles/globals.css';
/*
 * The one static import of content JSON in the app. global-error replaces the root layout,
 * so it renders outside AppProviders: there is no query cache to read GET /content/common
 * from, and fetching it here could fail for the same reason the layout did. The copy is
 * bundled at build time from the same dummy endpoint file instead.
 */
import common from '../../public/api/content/common.json';

const t = createTranslator(common);

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Replaces the root layout when it fails, so it brings its own document, styles
 * and fonts, then shows the same recovery screen as error.tsx.
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={fontVariables}>
      <body>
        <title>{t('error.documentTitle')}</title>
        <ErrorScreen t={t} reset={reset} />
      </body>
    </html>
  );
}
