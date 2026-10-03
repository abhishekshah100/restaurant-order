'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ToastRegion, type ToastData } from '@/components/ui';
import { TOAST_MS } from '@/lib/constants';

interface ShowToastOptions {
  tone?: ToastData['tone'];
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ShowToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Time a paused toast stays up after the pointer and focus leave it, at least. */
const RESUME_MIN_MS = 2000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const nextId = useRef(1);
  // One toast at a time, so one timer. While the guest hovers or focuses the toast
  // the timer is paused (WCAG 2.2.1) and the time left is kept in `remaining`.
  const timer = useRef<number | undefined>(undefined);
  const deadline = useRef(0);
  const remaining = useRef<number | null>(null);
  const currentId = useRef<number | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    if (currentId.current !== id) return;
    window.clearTimeout(timer.current);
    currentId.current = null;
    remaining.current = null;
  }, []);

  const schedule = useCallback(
    (id: number, ms: number) => {
      window.clearTimeout(timer.current);
      deadline.current = Date.now() + ms;
      timer.current = window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const showToast = useCallback(
    (message: string, options: ShowToastOptions = {}) => {
      const id = nextId.current++;
      const toast: ToastData = {
        id,
        message,
        tone: options.tone,
        actionLabel: options.actionLabel,
        onAction: options.onAction,
      };
      // Newest wins: it replaces any toast on screen and keeps the bottom clear.
      setToasts([toast]);
      currentId.current = id;
      const duration = options.duration ?? TOAST_MS;
      if (remaining.current !== null) remaining.current = duration;
      else schedule(id, duration);
    },
    [schedule],
  );

  const pause = useCallback(() => {
    if (currentId.current === null || remaining.current !== null) return;
    window.clearTimeout(timer.current);
    remaining.current = Math.max(0, deadline.current - Date.now());
  }, []);

  const resume = useCallback(() => {
    if (currentId.current === null || remaining.current === null) return;
    const left = Math.max(remaining.current, RESUME_MIN_MS);
    remaining.current = null;
    schedule(currentId.current, left);
  }, [schedule]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
