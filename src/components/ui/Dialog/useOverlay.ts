'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useHydrated } from '@/hooks/useHydrated';
import { useScrollLock } from '@/hooks/useScrollLock';

/**
 * Shared modal-overlay behaviour (Dialog, Lightbox): focus trapped in `ref` and restored on
 * close, body scroll locked and Esc to close while open.
 *
 * Returns `visible` (open and hydrated: render the portal) and a stable `close` that always
 * calls the latest `onClose`, safe to use from timers.
 */
export function useOverlay(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): { visible: boolean; close: () => void } {
  const hydrated = useHydrated();
  const onCloseRef = useRef(onClose);
  const visible = open && hydrated;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const close = useCallback(() => onCloseRef.current(), []);

  useFocusTrap(ref, visible);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  return { visible, close };
}
