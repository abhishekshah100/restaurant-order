'use client';

import { useRef } from 'react';
import { MAX_PROOFS } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { Icon, Spinner } from '@/components/ui';
import type { ProofPhoto } from './useProofPhotos';
import styles from './ProofPicker.module.css';

/**
 * Proof photos for a payment that isn't cash (optional): take one with the camera (phones open
 * it straight away) or choose several, up to MAX_PROOFS. Each shows at once, uploading until
 * kept; one that failed says so and is removed to go on.
 */
export function ProofPicker({
  id,
  photos,
  onAdd,
  onRemove,
}: {
  id: string;
  photos: readonly ProofPhoto[];
  onAdd: (files: File[]) => void;
  onRemove: (photoId: string) => void;
}) {
  const t = useContent('common');
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const full = photos.length >= MAX_PROOFS;
  const picked = (input: HTMLInputElement) => {
    onAdd(Array.from(input.files ?? []));
    // The same photo can be picked again after it's removed.
    input.value = '';
  };

  return (
    <div className={styles.picker} role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className={styles.label}>
        {t('adminPayments.proofs.label')}
        <span className={styles.count}>
          {t('adminPayments.proofs.count', { count: photos.length, max: MAX_PROOFS })}
        </span>
      </p>
      {photos.length > 0 && (
        <ul className={styles.thumbs}>
          {photos.map((photo, index) => (
            <li key={photo.id} className={styles.thumb}>
              {/* A local preview of the picked file (an object URL), not a page image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.preview} alt={t('adminPayments.proofs.photo', { n: index + 1 })} />
              {!photo.key && (
                <span className={styles.state} role="status">
                  {photo.failed ? (
                    <>
                      <Icon name="alert" size="xs" />
                      <span className="visually-hidden">{t('adminPayments.proofs.failed')}</span>
                    </>
                  ) : (
                    <>
                      <Spinner />
                      <span className="visually-hidden">{t('adminPayments.proofs.uploading')}</span>
                    </>
                  )}
                </span>
              )}
              <button
                type="button"
                className={styles.remove}
                aria-label={t('adminPayments.proofs.remove', { n: index + 1 })}
                onClick={() => onRemove(photo.id)}
              >
                <Icon name="x" size="xs" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {photos.some((p) => p.failed) && (
        <p className={styles.error} role="alert">
          {t('adminPayments.proofs.failedHint')}
        </p>
      )}
      {!full && (
        <div className={styles.actions}>
          <button type="button" className={styles.add} onClick={() => camera.current?.click()}>
            <Icon name="camera" size="xs" />
            {t('adminPayments.proofs.take')}
          </button>
          <button type="button" className={styles.add} onClick={() => gallery.current?.click()}>
            <Icon name="image" size="xs" />
            {t('adminPayments.proofs.choose')}
          </button>
        </div>
      )}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => picked(event.currentTarget)}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => picked(event.currentTarget)}
      />
    </div>
  );
}
