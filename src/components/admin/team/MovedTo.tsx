'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * A page that moved (Settings › Rota and Shifts, Team › Time sheet: under Team now): old links and bookmarks
 * land on the new address, the query (a time sheet's days) kept.
 */
export function MovedTo({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`${href}${window.location.search}`);
  }, [href, router]);
  return null;
}
