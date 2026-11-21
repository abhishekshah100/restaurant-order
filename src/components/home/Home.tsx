'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoadingSignal } from '@/components/layout/GlobalLoader';
import { StartView } from '@/components/start/StartView';
import { OrderingGate } from '@/components/status/OrderingGate';
import { useGuestSession, useVisit } from '@/context/GuestSessionContext';
import { Welcome } from './Welcome';

/**
 * `/`: where a guest lands. A table's QR code goes straight on to the menu once the table is
 * confirmed (the menu's header shows the table) — the welcome screen was one tap more for
 * nothing. Takeaway and delivery still get the welcome (where they order from, and Change).
 * Closed, paused or offline swaps in the restaurant-state screen; arriving without a QR code
 * shows the start screen, which stays up once shown, until the guest moves on, so it doesn't
 * flash the welcome.
 */
export function Home() {
  const { needsStart, mode } = useVisit();
  const [choosing, setChoosing] = useState(false);
  // Remembered during render (not in an effect), so the welcome never flashes in between.
  if (needsStart && !choosing) setChoosing(true);
  if (needsStart || choosing) return <StartView />;
  return <OrderingGate>{mode === 'dineIn' ? <ToMenu /> : <Welcome />}</OrderingGate>;
}

/**
 * A table's guests, ordering open: on to the menu as soon as the server has confirmed the table
 * (the scanned link is read, and its session opened, after the page first draws: leaving
 * earlier would lose it). Until then, the welcome with the table still loading.
 */
function ToMenu() {
  const router = useRouter();
  const confirmed = useGuestSession()?.table != null;
  useEffect(() => {
    if (confirmed) router.replace('/menu/');
  }, [confirmed, router]);
  return confirmed ? <LoadingSignal /> : <Welcome />;
}
