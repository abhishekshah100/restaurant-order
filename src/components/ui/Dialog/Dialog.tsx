'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useHydrated } from '@/hooks/useHydrated';
import { useScrollLock } from '@/hooks/useScrollLock';
import { IconButton } from '../IconButton/IconButton';
import styles from './Dialog.module.css';

export type DialogPresentation = 'sheet' | 'modal' | 'adaptive' | 'panel';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible title, shown in the header unless `hideTitle`. */
  title: ReactNode;
  hideTitle?: boolean;
  /** Serif display title (modal headings) instead of the UI title. */
  displayTitle?: boolean;
  description?: ReactNode;
  /** sheet (mobile), modal (desktop), adaptive (sheet → modal at 1024px), panel (slide-over). */
  presentation?: DialogPresentation;
  showClose?: boolean;
  /** Sticky footer, e.g. the "Add to cart" row. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Accessible dialog: portal, focus trap, Esc and scrim to close, body scroll lock,
 * focus restored to the trigger on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  hideTitle,
  displayTitle,
  description,
  presentation = 'adaptive',
  showClose = true,
  footer,
  children,
  className,
}: DialogProps) {
  const hydrated = useHydrated();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useFocusTrap(ref, open && hydrated);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open || !hydrated) return null;

  return createPortal(
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={cx(styles.dialog, styles[presentation], className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <span className={styles.grabber} aria-hidden="true" />
        <div className={styles.body}>
          {(!hideTitle || showClose) && (
            <div className={styles.head}>
              <h2
                id={titleId}
                className={cx(
                  hideTitle ? 'visually-hidden' : styles.title,
                  displayTitle && styles.titleDisplay,
                )}
              >
                {title}
              </h2>
              {showClose && <IconButton icon="x" label="Close" variant="soft" onClick={onClose} />}
            </div>
          )}
          {hideTitle && !showClose && (
            <h2 id={titleId} className="visually-hidden">
              {title}
            </h2>
          )}
          {description && (
            <div id={descId} className="t-body c2">
              {description}
            </div>
          )}
          {children}
        </div>
        {footer && <div className={styles.foot}>{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

export function Sheet(props: Omit<DialogProps, 'presentation'>) {
  return <Dialog {...props} presentation="sheet" />;
}

export function Modal(props: Omit<DialogProps, 'presentation'>) {
  return <Dialog {...props} presentation="modal" />;
}
