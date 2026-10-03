'use client';

import Image from 'next/image';
import { Button, Icon, StatusPill } from '@/components/ui';
import { useContent, useRestaurant } from '@/api/hooks';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import styles from './Welcome.module.css';

/** Welcome / table confirmation (01 · w01). Wrapped in OrderingGate by the page. */
export function Welcome() {
  const restaurant = useRestaurant();
  const table = useTable();
  const t = useContent('home');

  // Only shown while ordering is open: OrderingGate swaps in the closed / paused / offline screen.
  const kitchen = (
    <StatusPill status="served">{t('welcome.openUntil', { time: restaurant.closesAt })}</StatusPill>
  );

  const staffOnCall = (
    <span className={cx('t-small c2', styles.footNote)}>
      <Icon name="bell" size="xs" />
      {t('welcome.staffOnCall')}
    </span>
  );

  return (
    <div className={styles.page}>
      <div className={cx(styles.hero, 'hide-desktop')}>
        <Image
          className={styles.heroImg}
          src="/images/pasta-hero.jpg"
          alt={t('welcome.images.hero')}
          width={780}
          height={540}
          sizes="100vw"
          priority
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroBrand}>
          <Icon name="olive" />
          <span className={cx('t-caption', styles.heroCaption)}>{restaurant.name}</span>
        </div>
      </div>

      <div className={cx(styles.panel, 'hide-mobile')}>
        <div className={styles.panelBrand}>
          <Icon name="olive" />
          <span className={cx('t-caption', styles.panelCaption)}>{restaurant.name}</span>
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

      <main id="main" className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.heading}>
            <span className={styles.eyebrow}>{t('welcome.eyebrow')}</span>{' '}
            <span className={cx('t-display', styles.title)}>{restaurant.name}</span>
          </h1>
          <p className={cx('t-body c2', styles.lede)}>{t('welcome.lede')}</p>
        </div>

        <section className={styles.card} aria-label={t('welcome.tableCard')}>
          <div className={styles.cardMain}>
            <div className={styles.cardIcon}>
              <Icon name="table" />
            </div>
            <div className={styles.cardText}>
              <span className={styles.cardLabel}>{t('welcome.seatedAt')}</span>
              <span className={styles.tableNo}>{t('welcome.tableNumber', { table })}</span>
            </div>
          </div>
          <span className={styles.perforation} aria-hidden="true" />
          <div className={styles.cardStub}>
            <Icon name="pin" size="sm" className={styles.stubIcon} />
            <span className={styles.stubText}>
              {restaurant.tableLocation.split(' · ').map((part, i) => (
                <span key={part} className={i === 0 ? styles.stubPrimary : undefined}>
                  {part}
                  {/* Keep the original "Ground floor · Garden side" for screen readers */}
                  {i === 0 && <span className="visually-hidden"> · </span>}
                </span>
              ))}
            </span>
          </div>
        </section>

        <div className={cx(styles.statusRow, 'hide-desktop')}>
          {kitchen}
          {staffOnCall}
        </div>

        <div className={cx(styles.actions, 'hide-mobile')}>
          <Button href="/menu/" block iconEnd="arrow">
            {t('welcome.viewMenu')}
          </Button>
        </div>

        <div className={cx(styles.footRow, 'hide-mobile')}>
          {kitchen}
          {staffOnCall}
        </div>
      </main>

      <div className={cx(styles.actions, 'hide-desktop')}>
        <Button href="/menu/" block iconEnd="arrow">
          {t('welcome.viewMenu')}
        </Button>
      </div>
    </div>
  );
}
