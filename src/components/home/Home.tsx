'use client';

import { useState } from 'react';
import { StartView } from '@/components/start/StartView';
import { OrderingGate } from '@/components/status/OrderingGate';
import { useVisit } from '@/context/GuestSessionContext';
import { Welcome } from './Welcome';

/**
 * `/`: the welcome (01 · w01) for a guest with a session — closed, paused or offline swaps in
 * the restaurant-state screen — or the start screen when they arrived without a QR code. The
 * start screen stays up once shown, until the guest moves on, so it doesn't flash the welcome.
 */
export function Home() {
  const { needsStart } = useVisit();
  const [choosing, setChoosing] = useState(false);
  // Remembered during render (not in an effect), so the welcome never flashes in between.
  if (needsStart && !choosing) setChoosing(true);
  if (needsStart || choosing) return <StartView />;
  return (
    <OrderingGate>
      <Welcome />
    </OrderingGate>
  );
}
