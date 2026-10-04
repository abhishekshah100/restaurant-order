'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useGuestSession } from '@/context/GuestSessionContext';

/**
 * Table service (waiter, bill, paying the table's bill) is for guests at a table: a takeaway or
 * delivery guest who opens one of those pages goes to Help instead.
 */
export function useDineInOnly(): void {
  const router = useRouter();
  const session = useGuestSession();
  const away = session !== null && session.mode !== 'dineIn';
  useEffect(() => {
    if (away) router.replace('/help/');
  }, [away, router]);
}
