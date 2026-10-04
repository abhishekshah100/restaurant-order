'use client';

import Image from 'next/image';
import { Icon } from '@/components/ui';
import { useContent, useRestaurant } from '@/api/hooks';
import { cx } from '@/lib/cx';
import styles from './Welcome.module.css';

/** The desktop welcome's dark photo panel (w01): brand, gallery and tagline. Hidden below 1024px. */
export function BrandPanel({ caption }: { caption: string }) {
  const restaurant = useRestaurant();
  const t = useContent('home');
  return (
    <div className={cx(styles.panel, 'hide-mobile')}>
      <div className={styles.panelBrand}>
        <Icon name="olive" />
        <span className={cx('t-caption', styles.panelCaption)}>{caption}</span>
      </div>
      <div className={styles.gallery}>
        <Image
          className={styles.galleryTall}
          src="/images/pasta-hero.jpg"
          alt={t('welcome.images.pasta')}
          width={780}
          height={540}
          sizes="30vw"
          priority
        />
        <Image
          src="/images/prawns.jpg"
          alt={t('welcome.images.prawns')}
          width={240}
          height={228}
          sizes="25vw"
        />
        <Image
          src="/images/pizza-wide.jpg"
          alt={t('welcome.images.pizza')}
          width={462}
          height={300}
          sizes="25vw"
        />
      </div>
      <p className={styles.tagline}>{restaurant.tagline}</p>
    </div>
  );
}
