'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import styles from './InfoTip.module.css';

/**
 * A small ⓘ beside a word people may not know: tapped, it opens one plain sentence; tapped
 * again, Escape or a tap elsewhere closes it.
 */
export function InfoTip({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <span ref={root} className={styles.tip}>
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(!open);
        }}
      >
        <Icon name="info" size="xs" />
      </button>
      {open && (
        <span id={id} role="note" className={styles.bubble}>
          {children}
        </span>
      )}
    </span>
  );
}
