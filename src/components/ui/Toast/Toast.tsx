import { Icon } from '../Icon';
import styles from './Toast.module.css';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastData {
  id: number;
  message: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastProps {
  toast: ToastData;
  onDismiss: (id: number) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const tone = toast.tone ?? 'success';
  return (
    <div className={styles.toast}>
      {tone === 'success' && <Icon name="checkc" size="sm" className={styles.ok} />}
      {tone === 'error' && <Icon name="alert" size="sm" className={styles.warn} />}
      {tone === 'info' && <Icon name="info" size="sm" />}
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
    </div>
  );
}

export interface ToastRegionProps {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
}

/** Polite live region; always in the DOM so announcements are reliable. */
export function ToastRegion({ toasts, onDismiss }: ToastRegionProps) {
  return (
    <div className={styles.region} role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
