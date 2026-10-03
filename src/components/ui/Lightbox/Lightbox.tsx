'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '@/api/hooks';
import { useOverlay } from '../Dialog/useOverlay';
import { IconButton } from '../IconButton/IconButton';
import styles from './Lightbox.module.css';

export interface LightboxProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Shown under the photo, e.g. the dish name. */
  caption?: string;
}

/** Full-size photo viewer: dark backdrop, Esc / ✕ / tap outside to close, focus trapped. */
export function Lightbox({ open, onClose, src, alt, width, height, caption }: LightboxProps) {
  const t = useContent('common');
  const ref = useRef<HTMLDivElement>(null);
  const { visible } = useOverlay(ref, open, onClose);

  if (!visible) return null;

  return createPortal(
    <div
      ref={ref}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label={caption ? t('lightbox.labelWithCaption', { caption }) : t('lightbox.label')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <IconButton
        icon="x"
        label={t('lightbox.close')}
        className={styles.close}
        onClick={onClose}
        data-autofocus
      />
      <figure className={styles.figure} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <Image
          className={styles.img}
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="100vw"
        />
        {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      </figure>
    </div>,
    document.body,
  );
}
