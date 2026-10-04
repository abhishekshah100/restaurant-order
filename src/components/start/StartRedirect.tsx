'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useVisit } from '@/context/GuestSessionContext';

/** Pages that work without a session: `/` shows the start screen itself. */
const OPEN_PATHS = ['/start', '/styleguide'];

/**
 * A guest without a session (no QR code, nothing saved) who lands on an ordering page is sent
 * to the start screen to choose an outlet and a mode, and brought back afterwards (`?next=`).
 */
export function StartRedirect() {
  const { needsStart } = useVisit();
  const pathname = usePathname();
  const router = useRouter();
  const open = pathname === '/' || OPEN_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!needsStart || open) return;
    const next = `${pathname}${window.location.search}`;
    router.replace(`/start/?next=${encodeURIComponent(next)}`);
  }, [needsStart, open, pathname, router]);

  return null;
}
