'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useContent } from '@/api/hooks';
import { useUploadBranchImage } from '@/api/mutations';
import { Button, Icon } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { resizeImage } from '@/lib/imageResize';
import type { BranchImage } from '@/types/branch';
import { useAdminWorkspace } from '../../shell/AdminWorkspace';
import styles from './BranchPhotoField.module.css';

/**
 * The restaurant's photo (Settings › Details): add one (resized in the browser, then uploaded),
 * replace or remove it. It's saved with the rest of the details.
 */
export function BranchPhotoField({
  image,
  name,
  error,
  onChange,
}: {
  image: BranchImage | null;
  /** The branch's short name: the photo's description, and the initial shown without one. */
  name: string;
  error?: string;
  onChange: (image: BranchImage | null) => void;
}) {
  const t = useContent('common');
  const { branch } = useAdminWorkspace();
  const { showToast } = useToast();
  const upload = useUploadBranchImage();
  const input = useRef<HTMLInputElement>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    try {
      const resized = await resizeImage(file);
      const result = await upload.mutateAsync({ branchId: branch.id, body: resized });
      onChange(result.image);
    } catch {
      showToast(t('adminSettings.details.photoFailed'), { tone: 'error' });
    }
  };

  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <span className={styles.preview}>
          {image ? (
            <Image
              src={image.src}
              alt={t('adminSettings.details.photoAlt', { name })}
              width={image.width}
              height={image.height}
              className={styles.previewImg}
              sizes="96px"
              loading="eager"
            />
          ) : (
            <span className={styles.monogram} aria-hidden="true">
              {name.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="secondary"
            iconStart="plus"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            {image
              ? t('adminSettings.details.photoReplace')
              : t('adminSettings.details.photoUpload')}
          </Button>
          {image && (
            <Button size="sm" variant="ghost" iconStart="trash" onClick={() => onChange(null)}>
              {t('adminSettings.details.photoRemove')}
            </Button>
          )}
          <p className={styles.hint}>{t('adminSettings.details.photoFileHint')}</p>
        </div>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          <Icon name="alert" size="xs" />
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}
