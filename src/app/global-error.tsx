'use client';

import { useEffect } from 'react';
import { createTranslator } from '@/api/translator';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { fontVariables } from '@/fonts';
import '@/styles/globals.css';
/*
 * The one static import of content in the app. global-error replaces the root layout, so it
 * renders outside AppProviders: there is no query cache to read GET /content/common from, and
 * fetching it here could fail for the same reason the layout did. So its words are bundled:
 * only common › error (a copy kept equal by a unit test), since this file is part of every
 * page's JavaScript and the whole of common is mostly the admin screens' words.
 */
import copy from './global-error-copy.json';

const t = createTranslator(copy);

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
