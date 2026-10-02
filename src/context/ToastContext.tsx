'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ToastRegion, type ToastData } from '@/components/ui';
import { TOAST_MS } from '@/lib/constants';

export interface ShowToastOptions {
  tone?: ToastData['tone'];
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ShowToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

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
      // One toast at a time keeps the bottom of the screen clear (newest wins).
      setToasts([toast]);
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), options.duration ?? TOAST_MS),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
