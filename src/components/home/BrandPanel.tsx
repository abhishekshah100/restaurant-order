'use client';

import Image from 'next/image';
import { Icon } from '@/components/ui';
import { useRestaurant } from '@/api/hooks';
import type { BranchImage } from '@/types/branch';
import { cx } from '@/lib/cx';
import styles from './Welcome.module.css';

/**
 * The desktop welcome's dark panel (w01): brand, the branch's photo and the tagline. Hidden below
 * 1024px.
 */
export function BrandPanel({ caption, photo }: { caption: string; photo?: BranchImage | null }) {
  const restaurant = useRestaurant();
  return (
    <div className={cx(styles.panel, 'hide-mobile')}>
      <div className={styles.panelBrand}>
        <Icon name="olive" />
        <span className={cx('t-caption', styles.panelCaption)}>{caption}</span>
      </div>
      {/* The branch's own photo; none yet: the brand alone (never another restaurant's food). */}
      {photo ? (
        <div className={cx(styles.gallery, styles.galleryOne)}>
          <Image
            src={photo.src}
            alt=""
            width={photo.width}
            height={photo.height}
            sizes="50vw"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      ) : (
        <div className={styles.galleryEmpty} aria-hidden="true">
          <Icon name="olive" />
        </div>
      )}
      <p className={styles.tagline}>{restaurant.tagline}</p>
    </div>
  );
}
