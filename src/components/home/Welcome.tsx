'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button, Icon, StatusPill } from '@/components/ui';
import { useBranch, useContent } from '@/api/hooks';
import { MODE_ICON } from '@/components/start/ModeOptions';
import { useVisit } from '@/context/GuestSessionContext';
import { useTableLabel } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import { BrandPanel } from './BrandPanel';
import styles from './Welcome.module.css';

/** The ticket card for takeaway and delivery: what the guest is ordering, and from where. */
function ModeCard({ mode }: { mode: 'takeaway' | 'delivery' }) {
  const branch = useBranch();
  const { deliveryArea } = useVisit();
  const t = useContent('home');
  let place = t('welcome.modeCard.pickupAt');
  if (mode === 'delivery') {
    place = deliveryArea
      ? t('welcome.modeCard.deliveringTo', { area: deliveryArea })
      : t('welcome.modeCard.chooseArea');
  }
  return (
    <section className={styles.card} aria-label={t('welcome.modeCard.label')}>
      <div className={styles.cardMain}>
        <div className={styles.cardIcon}>
          <Icon name={MODE_ICON[mode]} />
        </div>
        <div className={styles.cardText}>
          <span className={styles.cardLabel}>{t('welcome.modeCard.orderingFor')}</span>
          <span className={styles.tableNo}>{t(`welcome.modeCard.${mode}`)}</span>
        </div>
      </div>
      <span className={styles.perforation} aria-hidden="true" />
      <div className={styles.cardStub}>
        <Icon name="pin" size="sm" className={styles.stubIcon} />
        <span className={styles.stubText}>
          <span className={styles.stubPrimary}>{branch.shortName}</span>
          <span>{place}</span>
          <Link href="/start/" className={styles.change}>
            {t('welcome.modeCard.change')}
          </Link>
        </span>
      </div>
    </section>
  );
}

/** Welcome / table confirmation (01 · w01); for takeaway and delivery, what's being ordered. Wrapped in OrderingGate by the page. */
export function Welcome() {
  const branch = useBranch();
  const { mode } = useVisit();
  const table = useTableLabel();
  const t = useContent('home');

  // Only shown while ordering is open: OrderingGate swaps in the closed / paused / offline screen.
  const kitchen = (
    <StatusPill status="served">{t('welcome.openUntil', { time: branch.closesAt })}</StatusPill>
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
          <span className={cx('t-caption', styles.heroCaption)}>{branch.name}</span>
        </div>
      </div>

      <BrandPanel caption={branch.name} />

      <main id="main" className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.heading}>
            <span className={styles.eyebrow}>{t('welcome.eyebrow')}</span>{' '}
            <span className={cx('t-display', styles.title)}>{branch.name}</span>
          </h1>
          <p className={cx('t-body c2', styles.lede)}>
            {mode === 'dineIn'
              ? t('welcome.lede')
              : t(`welcome.modeCard.lede.${mode}`, { branch: branch.shortName })}
          </p>
        </div>

        {mode !== 'dineIn' ? (
          <ModeCard mode={mode} />
        ) : (
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
                {branch.tableLocation.split(' · ').map((part, i) => (
                  <span key={part} className={i === 0 ? styles.stubPrimary : undefined}>
                    {part}
                    {/* Keep the original "Ground floor · Garden side" for screen readers */}
                    {i === 0 && <span className="visually-hidden"> · </span>}
                  </span>
                ))}
              </span>
            </div>
          </section>
        )}

        <div className={cx(styles.statusRow, 'hide-desktop')}>
          {kitchen}
          {mode === 'dineIn' && staffOnCall}
        </div>

        <div className={cx(styles.actions, 'hide-mobile')}>
          <Button href="/menu/" block iconEnd="arrow">
            {t('welcome.viewMenu')}
          </Button>
        </div>

        <div className={cx(styles.footRow, 'hide-mobile')}>
          {kitchen}
          {mode === 'dineIn' && staffOnCall}
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
