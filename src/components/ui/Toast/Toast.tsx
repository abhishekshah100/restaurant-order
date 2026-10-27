'use client';

import { useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from '../Icon';
import styles from './Toast.module.css';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastData {
  id: number;
  message: string;
  tone?: ToastTone;
  /** Overrides the tone's icon ("trash" for something removed). */
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  /** Dismissed, fading out. */
  leaving?: boolean;
}

export interface ToastProps {
  toast: ToastData;
  onDismiss: (id: number) => void;
}

const TONE_ICON: Record<ToastTone, IconName> = { success: 'checkc', error: 'alert', info: 'info' };

/** How far (px) a toast is swiped, down or sideways, to dismiss it. */
const SWIPE_DISMISS = 48;

/**
 * A compact pill: an icon, the message, its action (Undo) and ✕. Swiped down or sideways it
 * goes, as with ✕.
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const t = useContent('common');
  const tone = toast.tone ?? 'success';
  const start = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    start.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    // Sideways either way, or down; never up into the page.
    setDrag({
      x: event.clientX - start.current.x,
      y: Math.max(0, event.clientY - start.current.y),
    });
  };
  const onPointerEnd = () => {
    if (!start.current) return;
    start.current = null;
    if (Math.abs(drag.x) > SWIPE_DISMISS || drag.y > SWIPE_DISMISS) onDismiss(toast.id);
    else setDrag({ x: 0, y: 0 });
  };
  const dragging = drag.x !== 0 || drag.y !== 0;

  return (
    <div
      className={cx(
        styles.toast,
        styles[tone],
        toast.leaving && styles.leaving,
        dragging && styles.dragging,
      )}
      style={
        dragging
          ? {
              translate: `${drag.x}px ${drag.y}px`,
              opacity: Math.max(0.3, 1 - Math.max(Math.abs(drag.x), drag.y) / 160),
            }
          : undefined
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <Icon name={toast.icon ?? TONE_ICON[tone]} size="sm" className={styles.icon} />
      <span className={styles.msg}>{toast.message}</span>
      {toast.actionLabel && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.onAction?.();
            onDismiss(toast.id);
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        className={styles.close}
        aria-label={t('toast.dismiss')}
        onClick={() => onDismiss(toast.id)}
      >
        <Icon name="x" size="xs" />
      </button>
    </div>
  );
}

export interface ToastRegionProps {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
  /** Called while the pointer or keyboard focus is on a toast, so its timer can wait. */
  onPause?: () => void;
  onResume?: () => void;
}

/**
 * Polite live region; always in the DOM so announcements are reliable.
 * Hovering or focusing a toast pauses its timer (WCAG 2.2.1).
 */
export function ToastRegion({ toasts, onDismiss, onPause, onResume }: ToastRegionProps) {
  const hovered = useRef(false);
  const focused = useRef(false);
  const release = () => {
    if (!hovered.current && !focused.current) onResume?.();
  };

  return (
    <div
      className={styles.region}
      role="status"
      aria-live="polite"
      aria-atomic="false"
      onPointerEnter={() => {
        hovered.current = true;
        onPause?.();
      }}
      onPointerLeave={() => {
        hovered.current = false;
        release();
      }}
      onFocus={() => {
        focused.current = true;
        onPause?.();
      }}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        focused.current = false;
        release();
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
