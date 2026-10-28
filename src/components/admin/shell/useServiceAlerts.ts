'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useContent } from '@/api/hooks';
import { useToast } from '@/context/ToastContext';
import { STORAGE_KEYS } from '@/lib/storage';
import type { AdminBranchService } from '@/types/admin';
import { playChime } from '../../kitchen/shell/kitchenSound';
import { useSoundUnlock } from '../../kitchen/shell/useSoundUnlock';

/*
 * Alerts for the floor staff on this device: when food is ready to serve, a guest calls a waiter
 * or asks for the bill, or the kitchen sends a message, a chime plays, the phone vibrates (where
 * the browser can: Android, not iPhone) and a toast says what it is. On by default; staff turn it
 * off from the bar (kept on the device).
 */

const listeners = new Set<() => void>();

function readOn(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.staffAlerts) !== 'off';
  } catch {
    return true;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Whether alerts are on for this device, and switching them. */
export function useAlertsSetting(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, readOn, () => true);
  const set = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.staffAlerts, next ? 'on' : 'off');
    } catch {
      // Storage blocked: the setting lasts for this page only.
    }
    for (const listener of listeners) listener();
  }, []);
  return [on, set];
}

/** A short pattern: two pulses, felt but not alarming. */
const VIBRATION = [180, 90, 180];

/**
 * Watches the floor (the service board) and alerts for what's new since the last read: ready
 * rounds, waiter calls, bill requests and kitchen messages. What's there when the page opens
 * isn't new. Returns whether sound still needs a tap on the page (browsers ask for one).
 */
export function useServiceAlerts(service: AdminBranchService | undefined, on: boolean): boolean {
  const t = useContent('common');
  const { showToast } = useToast();
  const seen = useRef<Set<string> | null>(null);
  const needsTap = useSoundUnlock(on);

  useEffect(() => {
    if (!service) return;
    const now = new Map<string, string>();
    for (const order of service.orders) {
      for (const r of order.readyRounds) {
        now.set(
          `ready:${order.id}:${r.round}`,
          order.table !== undefined
            ? t('adminShell.alerts.readyTable', { table: order.table, round: r.round })
            : t('adminShell.alerts.readyOrder', { order: order.id }),
        );
      }
    }
    for (const r of service.requests) {
      now.set(
        `req:${r.id}`,
        r.kind === 'kitchen'
          ? t('adminShell.alerts.kitchen', { order: r.orderId })
          : t(`adminShell.alerts.${r.kind}`, { table: r.table }),
      );
    }
    const before = seen.current;
    seen.current = new Set(now.keys());
    if (!before || !on) return;
    const fresh = [...now].filter(([key]) => !before.has(key)).map(([, text]) => text);
    if (fresh.length === 0) return;
    playChime('service');
    navigator.vibrate?.(VIBRATION);
    showToast(
      fresh.length === 1
        ? fresh[0]
        : t('adminShell.alerts.many', { first: fresh[0], count: fresh.length - 1 }),
      { tone: 'info', icon: 'bell' },
    );
  }, [service, on, t, showToast]);

  return needsTap;
}
