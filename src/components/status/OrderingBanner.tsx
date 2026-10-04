'use client';

import { Banner } from '@/components/ui';
import { useBranch, useContent } from '@/api/hooks';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { cx } from '@/lib/cx';
import type { OrderingState } from '@/types/restaurant';
import styles from './OrderingBanner.module.css';

export interface StateBannerProps {
  state: Exclude<OrderingState, 'open'>;
  className?: string;
}

/** The banner for one restaurant state (ws02 paused, s03 · ws03 offline; closed follows the same pattern). */
export function StateBanner({ state, className }: StateBannerProps) {
  const branch = useBranch();
  const t = useContent('status');
  if (state === 'offline') {
    return (
      <Banner tone="err" icon="wifioff" live="assertive" className={className}>
        <span className="hide-desktop">{t('banner.offlineMobile')}</span>
        <span className="hide-mobile">{t('banner.offlineDesktop')}</span>
      </Banner>
    );
  }
  if (state === 'paused') {
    return (
      <Banner tone="warn" icon="clock" live="polite" className={className}>
        {t('banner.paused', { minutes: branch.pausedForMinutes })}
      </Banner>
    );
  }
  return (
    <Banner tone="err" icon="store" live="polite" className={className}>
      {t('banner.closed', { time: branch.opensAt })}
    </Banner>
  );
}

/**
 * Banner row under the headers of a browsing page (menu, search, cart) while ordering is
 * unavailable. `inline` drops the row padding, for use inside a page's own column.
 */
export function OrderingBanner({ inline, className }: { inline?: boolean; className?: string }) {
  const { state } = useOrderingAvailability();
  if (state === 'open') return null;
  if (inline) return <StateBanner state={state} className={className} />;
  return (
    <div className={cx(styles.row, className)}>
      <StateBanner state={state} />
    </div>
  );
}
