'use client';

import { useEffect } from 'react';
import { useContent } from '@/api/hooks';
import { ErrorScreen } from '@/components/layout/ErrorScreen';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Recovery screen for a runtime error in any page. `reset` re-renders the page
 * without a network round trip; the cart and checkout are kept in storage.
 */
export default function ErrorPage({ error, reset }: Props) {
  const t = useContent('common');
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen t={t} reset={reset} />;
}
