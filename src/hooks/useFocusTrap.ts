'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Keeps Tab / Shift+Tab inside `ref` while active, moves focus in on open
 * (to `[data-autofocus]` or the first focusable) and restores it on close.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const previous = document.activeElement as HTMLElement | null;

    const initial =
      root.querySelector<HTMLElement>('[data-autofocus]') ?? focusables(root)[0] ?? root;
    initial.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !root) return;
      const items = focusables(root);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
