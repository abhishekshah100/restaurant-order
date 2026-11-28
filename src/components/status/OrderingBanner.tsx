'use client';

import { Banner } from '@/components/ui';
import { useBranch, useContent } from '@/api/hooks';
import { useVisit } from '@/context/GuestSessionContext';
import { useBranchTimes } from '@/hooks/useBranchTimes';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { cx } from '@/lib/cx';
import { pausedMinutes } from '@/lib/restaurantStatus';
import type { OrderingState } from '@/types/restaurant';
import styles from './OrderingBanner.module.css';

export interface StateBannerProps {
  state: Exclude<OrderingState, 'open'>;
  className?: string;
}

/** The banner for one restaurant state (ws02 paused, s03 · ws03 offline; closed follows the same pattern). */
export function StateBanner({ state, className }: StateBannerProps) {
  const { mode } = useVisit();
  const times = useBranchTimes(useBranch(), mode);
  const t = useContent('status');
  const common = useContent('common');
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
        {t('banner.paused', { minutes: pausedMinutes(times?.pausedForMinutes ?? 0) })}
      </Banner>
    );
  }
  // Words that need the time wait for the first client render (never a wrong time).
  if (!times) return null;
  const time = times.opensAt ?? '';
  const day = times.reopensOn ? t(`hours.weekdays.${times.reopensOn}`) : '';
  // Takeaway or delivery closed on hours of its own: say which (dine-in may be open).
  if (mode !== 'dineIn') {
    const name = common(`modes.${mode}`);
    return (
      <Banner tone="err" icon="store" live="polite" className={className}>
        {times.reopensTomorrow
          ? t('banner.modeClosedTomorrow', { mode: name, time })
          : times.reopensOn
            ? t('banner.modeClosedOn', { mode: name, time, day })
            : t('banner.modeClosed', { mode: name, time })}
      </Banner>
    );
  }
  return (
    <Banner tone="err" icon="store" live="polite" className={className}>
      {times.reopensTomorrow
        ? t('banner.closedTomorrow', { time })
        : times.reopensOn
          ? t('banner.closedOn', { time, day })
          : t('banner.closed', { time })}
    </Banner>
  );
}

/** Within this many minutes of last orders, guests are told to order soon. */
const SOON_MINUTES = 15;

/** "Last orders in 12 min — place your order soon": while open, in the last minutes. */
function ClosingSoonBanner({ className }: { className?: string }) {
  const times = useBranchTimes(useBranch(), useVisit().mode);
  const t = useContent('status');
  const left = times?.minutesLeft;
  if (!left || left > SOON_MINUTES) return null;
  return (
    <Banner tone="warn" icon="clock" live="polite" className={className}>
      {t('banner.closingSoon', { minutes: left })}
    </Banner>
  );
}

/**
 * Banner row under the headers of a browsing page (menu, search, cart) while ordering is
 * unavailable. `inline` drops the row padding, for use inside a page's own column.
 */
export function OrderingBanner({ inline, className }: { inline?: boolean; className?: string }) {
  const t = useContent('status');
  const { state, menuOnly, suspended } = useOrderingAvailability();
  // Locked for being over the restaurant's package's branches (ADR-056).
  const branchLocked = useBranch().branchLocked === true;
  if (menuOnly && state !== 'offline') {
    const banner = (
      <Banner tone="info" icon="menu" className={inline ? className : undefined}>
        {t(
          suspended ? 'banner.suspended' : branchLocked ? 'banner.branchLocked' : 'banner.menuOnly',
        )}
      </Banner>
    );
    return inline ? banner : <div className={cx(styles.row, className)}>{banner}</div>;
  }
  if (state === 'open') {
    if (inline) return <ClosingSoonBanner className={className} />;
    return <ClosingSoonRow className={className} />;
  }
  if (inline) return <StateBanner state={state} className={className} />;
  return (
    <div className={cx(styles.row, className)}>
      <StateBanner state={state} />
    </div>
  );
}

/** The closing-soon banner in its row, only when it shows (no empty row otherwise). */
function ClosingSoonRow({ className }: { className?: string }) {
  const times = useBranchTimes(useBranch(), useVisit().mode);
  const left = times?.minutesLeft;
  if (!left || left > SOON_MINUTES) return null;
  return (
    <div className={cx(styles.row, className)}>
      <ClosingSoonBanner />
    </div>
  );
}
