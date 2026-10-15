'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TableQrCode } from '@/types/admin';
import { QrCard } from './QrCard';
import styles from './PrintSheet.module.css';

/** Set on <html> while the sheet prints: everything else on the page is hidden. */
const PRINTING = 'printing-qr';

/**
 * Printing table QR cards: `print(codes)` puts them on an A4 sheet (two across), opens the
 * browser's print dialog with only the sheet showing, and takes the sheet away afterwards.
 */
export function usePrintSheet(origin: string) {
  const [codes, setCodes] = useState<readonly TableQrCode[] | null>(null);

  useEffect(() => {
    if (!codes) return;
    const root = document.documentElement;
    const done = () => {
      root.classList.remove(PRINTING);
      setCodes(null);
    };
    root.classList.add(PRINTING);
    window.addEventListener('afterprint', done, { once: true });
    // After the sheet has rendered.
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
      root.classList.remove(PRINTING);
    };
  }, [codes]);

  const sheet =
    codes &&
    createPortal(
      <div className={styles.sheet} data-print-sheet="">
        {codes.map((code) => (
          <QrCard key={code.table} code={code} origin={origin} className={styles.card} />
        ))}
      </div>,
      document.body,
    );

  return { print: (next: readonly TableQrCode[]) => setCodes(next), sheet };
}
