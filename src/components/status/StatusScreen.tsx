'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Banner, Button, Icon, type IconName } from '@/components/ui';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { useContent, useRestaurant } from '@/api/hooks';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { cx } from '@/lib/cx';
import { compactTimeRange } from '@/lib/restaurantStatus';
import type { OrderingState } from '@/types/restaurant';
import { StateBanner } from './OrderingBanner';
import styles from './StatusScreen.module.css';

export type UnavailableState = Exclude<OrderingState, 'open'>;

/**
 * Full-page restaurant state: closed (s01 · ws01), ordering paused (s02 · ws02)
 * or offline (s03 · ws03). Shown on the welcome page and instead of checkout.
 */
export function StatusScreen({ state }: { state: UnavailableState }) {
  return (
    <div className={styles.page}>
      <SiteHeader variant={state === 'paused' ? 'default' : 'minimal'} />
      <MobileHeader variant="restaurant" />
      {state !== 'closed' && (
        <div className={cx(styles.bannerRow, state === 'paused' && 'hide-mobile')}>
          <StateBanner state={state} />
        </div>
      )}
      <main id="main" className={cx(styles.main, state !== 'closed' && styles.belowBanner)}>
        {state === 'closed' && <ClosedCard />}
        {state === 'paused' && <PausedCard />}
        {state === 'offline' && <OfflineCard />}
      </main>
    </div>
  );
}

function StatusCard({
  icon,
  tone,
  title,
  lede,
  wide,
  children,
  actions,
  soloAction,
}: {
  icon: IconName;
  tone: 'neutral' | 'warn';
  title: string;
  lede: ReactNode;
  /** Wider card for the opening-hours grid (ws01). */
  wide?: boolean;
  children?: ReactNode;
  actions: ReactNode;
  /** One centred button on desktop (ws03). */
  soloAction?: boolean;
}) {
  return (
    <section className={cx(styles.card, wide && styles.wide)} aria-labelledby="status-title">
      <div className={styles.body}>
        <div className={cx(styles.art, styles[tone])}>
          <Icon name={icon} size="xl" />
        </div>
        <h1 id="status-title" className="t-h1">
          {title}
        </h1>
        <p className={cx('t-body c2', styles.lede, wide && styles.ledeWide)}>{lede}</p>
        {children}
      </div>
      <div className={cx(styles.actions, soloAction && styles.solo)}>{actions}</div>
    </section>
  );
}

function ClosedCard() {
  const restaurant = useRestaurant();
  const t = useContent('status');
  return (
    <StatusCard
      icon="store"
      tone="neutral"
      title={t('closed.title')}
      wide
      lede={t.rich(
        'closed.lede',
        { b: (c) => <b className={styles.ink}>{c}</b> },
        { time: restaurant.opensAt, opensIn: restaurant.opensIn },
      )}
      actions={
        <>
          <Button href="/menu/">{t('closed.browse')}</Button>
          <Button href={restaurant.phoneHref} variant="secondary" iconStart="phone">
            {t('closed.call')}
          </Button>
        </>
      }
    >
      <dl className={styles.hours} aria-label={t('closed.hoursLabel')}>
        {restaurant.serviceWindows.map((w) => (
          <div key={w.label} className={styles.hour}>
            <dt className={styles.hourLabel}>{w.label}</dt>
            <dd className={styles.hourValue}>
              <span className="hide-desktop">{w.hours}</span>
              <span className="hide-mobile">{compactTimeRange(w.hours)}</span>
            </dd>
          </div>
        ))}
        <div className={styles.hour}>
          <dt className={styles.hourLabel}>
            <span className="hide-desktop">{t('closed.lastOrderMobile')}</span>
            <span className="hide-mobile">{t('closed.lastOrderDesktop')}</span>
          </dt>
          <dd className={styles.hourValue}>{restaurant.lastOrdersNote}</dd>
        </div>
      </dl>
    </StatusCard>
  );
}

function PausedCard() {
  const restaurant = useRestaurant();
  const { openRequest } = useServiceRequest();
  const t = useContent('status');
  return (
    <StatusCard
      icon="clock"
      tone="warn"
      title={t('paused.title')}
      lede={
        <>
          <span className="hide-desktop">
            {t.rich(
              'paused.ledeMobile',
              { b: (c) => <b className={styles.ink}>{c}</b> },
              { minutes: restaurant.pausedForMinutes },
            )}
          </span>
          <span className="hide-mobile">{t('paused.ledeDesktop')}</span>
        </>
      }
      actions={
        <>
          <Button iconStart="bell" onClick={() => openRequest('waiter')}>
            {t('paused.callWaiter')}
          </Button>
          <Button href="/menu/" variant="secondary">
            {t('paused.keepBrowsing')}
          </Button>
        </>
      }
    >
      <Banner tone="info" icon="bell" className={cx(styles.note, 'hide-desktop')}>
        {t('paused.note')}
      </Banner>
    </StatusCard>
  );
}

/** How long "Try again" shows its spinner while the connection is re-checked. */
const RECHECK_MS = 800;

function OfflineCard() {
  const restaurant = useRestaurant();
  const { retry } = useOrderingAvailability();
  const t = useContent('status');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!checking) return;
    const id = window.setTimeout(() => setChecking(false), RECHECK_MS);
    return () => window.clearTimeout(id);
  }, [checking]);

  return (
    <StatusCard
      icon="wifioff"
      tone="neutral"
      title={t('offline.title')}
      lede={
        <>
          <span className="hide-desktop">{t('offline.ledeMobile')}</span>
          <span className="hide-mobile">{t('offline.ledeDesktop')}</span>
        </>
      }
      soloAction
      actions={
        <Button
          iconStart="refresh"
          loading={checking}
          onClick={() => {
            setChecking(true);
            retry();
          }}
        >
          {t('offline.retry')}
        </Button>
      }
    >
      <p className={styles.wifi}>
        <Icon name="info" size="sm" className="c2" />
        <span className="t-small">
          {t.rich('offline.wifi', { b: (c) => <b>{c}</b> }, { wifi: restaurant.wifiName })}
        </span>
      </p>
    </StatusCard>
  );
}
