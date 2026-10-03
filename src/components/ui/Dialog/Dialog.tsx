'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '@/api/hooks';
import { DESKTOP_QUERY } from '@/hooks/useMediaQuery';
import { cx } from '@/lib/cx';
import { IconButton } from '../IconButton/IconButton';
import { useOverlay } from './useOverlay';
import styles from './Dialog.module.css';

export type DialogPresentation = 'sheet' | 'modal' | 'adaptive' | 'panel';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible title, shown in the header unless `hideTitle` or `labelledBy`. */
  title: ReactNode;
  /** Id of a heading inside `header` that names the dialog; replaces the built-in header. */
  labelledBy?: string;
  /** Custom header that stays fixed above the scrolling content (use with `labelledBy`). */
  header?: ReactNode;
  hideTitle?: boolean;
  description?: ReactNode;
  /** sheet (mobile), modal (desktop), adaptive (sheet → modal at 1024px), panel (slide-over). */
  presentation?: DialogPresentation;
  /** Fixed footer, e.g. the "Add to cart" row. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Drag distance (px) or flick speed (px/ms) that closes a sheet. */
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 0.6;
/** Lets the swipe-away transition finish before closing. */
const SWIPE_CLOSE_MS = 180;

/**
 * Accessible dialog: portal, focus trap, Esc and scrim to close, body scroll lock,
 * focus restored to the trigger on close.
 *
 * The header and footer stay put while only the middle scrolls. Scroll hints
 * (a hairline under the header, a fade and lifted footer when there's more
 * below) show where content continues. As a bottom sheet it can be swiped down
 * to close from the grab handle or header.
 */
export function Dialog({
  open,
  onClose,
  title,
  labelledBy,
  header,
  hideTitle,
  description,
  presentation = 'adaptive',
  footer,
  children,
  className,
}: DialogProps) {
  const t = useContent('common');
  const ref = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const swipeTimer = useRef<number | undefined>(undefined);
  const titleId = useId();
  const descId = useId();
  const { visible, close } = useOverlay(ref, open, onClose);
  const drag = useRef<{
    id: number;
    startY: number;
    t: number;
    dy: number;
    active: boolean;
  } | null>(null);

  useEffect(() => () => window.clearTimeout(swipeTimer.current), []);

  /* ---------- Scroll hints ---------- */
  const updateScrollHints = useCallback(() => {
    const body = bodyRef.current;
    const el = ref.current;
    if (!body || !el) return;
    el.dataset.scrolled = String(body.scrollTop > 2);
    el.dataset.more = String(body.scrollTop + body.clientHeight < body.scrollHeight - 2);
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    const body = bodyRef.current;
    if (!body) return;
    updateScrollHints();
    const observer = new ResizeObserver(updateScrollHints);
    observer.observe(body);
    if (body.firstElementChild) observer.observe(body.firstElementChild);
    return () => observer.disconnect();
  }, [visible, updateScrollHints]);

  /* ---------- Swipe down to close (bottom sheets only) ---------- */
  const isSheetNow = () =>
    presentation === 'sheet' ||
    (presentation === 'adaptive' && !window.matchMedia(DESKTOP_QUERY).matches);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !isSheetNow()) return;
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      t: performance.now(),
      dy: 0,
      active: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || event.pointerId !== d.id) return;
    const dy = event.clientY - d.startY;
    if (!d.active) {
      if (dy < 6) return;
      d.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      el.style.transition = 'none';
      el.style.animation = 'none';
    }
    d.dy = Math.max(0, dy);
    el.style.transform = `translateY(${d.dy}px)`;
    if (scrimRef.current) {
      scrimRef.current.style.opacity = String(Math.max(0.2, 1 - d.dy / (el.offsetHeight || 1)));
    }
  };

  const endDrag = () => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d?.active || !el) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t);
    el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';
    if (d.dy > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) {
      el.style.transform = 'translateY(100%)';
      window.clearTimeout(swipeTimer.current);
      swipeTimer.current = window.setTimeout(close, SWIPE_CLOSE_MS);
    } else {
      el.style.transform = '';
      if (scrimRef.current) scrimRef.current.style.opacity = '';
    }
  };

  if (!visible) return null;

  return createPortal(
    <>
      <div ref={scrimRef} className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={cx(styles.dialog, styles[presentation], className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div
          className={styles.dragZone}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className={styles.grabber} aria-hidden="true" />
          {labelledBy ? (
            header && <div className={styles.headCustom}>{header}</div>
          ) : (
            <div className={styles.head}>
              <h2 id={titleId} className={hideTitle ? 'visually-hidden' : styles.title}>
                {title}
              </h2>
              <IconButton icon="x" label={t('dialog.close')} variant="soft" onClick={onClose} />
            </div>
          )}
        </div>
        <div className={styles.bodyWrap}>
          <div ref={bodyRef} className={styles.body} onScroll={updateScrollHints}>
            <div className={styles.content}>
              {description && (
                <div id={descId} className="t-body c2">
                  {description}
                </div>
              )}
              {children}
            </div>
          </div>
          <span className={styles.fade} aria-hidden="true" />
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
