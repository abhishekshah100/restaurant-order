'use client';

import { useEffect, useRef, useState } from 'react';
import type { KitchenTicket } from '@/lib/kitchenBoard';

interface KeyActions {
  /** Start cooking, or mark ready. */
  onNext: (ticket: KitchenTicket) => void;
  onOpen: (ticket: KitchenTicket) => void;
  onPrint: (ticket: KitchenTicket) => void;
  /** Takes back the last step forward. */
  onUndo: () => void;
}

/**
 * The board from a keyboard or a bump bar (which sends keys): ↑ ↓ (or ← →) and 1–9 pick a
 * ticket in the order shown, Enter moves it on, Backspace takes the last step back, F opens it
 * large, P prints it, Esc clears the pick. Keys typed in a field, or with a pop-up open, are left alone; so is Enter on a focused
 * button (that's the button's own). Returns the picked ticket's key; the board scrolls to it.
 */
export function useBoardKeyboard(order: readonly KitchenTicket[], actions: KeyActions) {
  const [picked, setPicked] = useState<string | null>(null);
  const latest = useRef({ order, actions, picked });
  useEffect(() => {
    latest.current = { order, actions, picked };
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if ((event.key === 'Enter' || event.key === ' ') && target?.closest('button, a')) return;

      const { order: list, actions: act, picked: key } = latest.current;
      const index = list.findIndex((ticket) => ticket.key === key);
      const ticket = index >= 0 ? list[index] : undefined;
      const pick = (i: number) => {
        const next = list[Math.min(Math.max(i, 0), list.length - 1)];
        if (next) setPicked(next.key);
      };

      let handled = true;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') pick(index + 1);
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') pick(index - 1);
      else if (/^[1-9]$/.test(event.key)) pick(Number(event.key) - 1);
      else if (event.key === 'Escape') setPicked(null);
      else if (event.key === 'Backspace') act.onUndo();
      else if (ticket && event.key === 'Enter') act.onNext(ticket);
      else if (ticket && (event.key === 'f' || event.key === 'F')) act.onOpen(ticket);
      else if (ticket && (event.key === 'p' || event.key === 'P')) act.onPrint(ticket);
      else handled = false;
      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A picked ticket that has left the board isn't picked any more.
  const current = picked && order.some((ticket) => ticket.key === picked) ? picked : null;

  useEffect(() => {
    if (!current) return;
    document
      .querySelector(`[data-ticket="${CSS.escape(current)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  return current;
}
