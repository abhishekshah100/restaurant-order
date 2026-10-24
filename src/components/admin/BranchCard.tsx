'use client';

import Image from 'next/image';
import { useId } from 'react';
import { useContent } from '@/api/hooks';
import { Icon, type IconName } from '@/components/ui';
import { createClock } from '@/lib/clock';
import { cx } from '@/lib/cx';
import type { AdminBranch } from '@/types/admin';
import type { OrderMode } from '@/types/branch';
import styles from './BranchCard.module.css';
import { useBranchTimes } from '@/hooks/useBranchTimes';

const MODE_ICONS: Record<OrderMode, IconName> = {
  dineIn: 'cutlery',
  takeaway: 'bag',
  delivery: 'scooter',
};

export interface BranchCardProps {
  branch: AdminBranch;
  /** The current time (useNow), shown in the branch's time zone; null until it's known. */
  now: Date | null;
  /** The branch the admin worked in last on this device. */
  lastUsed?: boolean;
  onSelect: (branchId: string) => void;
}

/** The branch's photo at a size its file covers, or its initial on a brand tile. */
function BranchThumb({ branch }: { branch: AdminBranch }) {
  if (!branch.image) {
    return (
      <span className={cx(styles.thumb, styles.monogram)} aria-hidden="true">
        {branch.shortName.charAt(0).toUpperCase()}
      </span>
    );
  }
  const { src, width, height } = branch.image;
  return <Image className={styles.thumb} src={src} width={width} height={height} alt="" />;
}

/**
 * One branch in the admin branch picker. The whole card is one target: the name's button
 * stretches over it, and the rest of the card describes it to screen readers.
 */
export function BranchCard({ branch, now, lastUsed = false, onSelect }: BranchCardProps) {
  const t = useContent('common');
  const hoursToday = useBranchTimes(branch)?.hoursToday ?? '';
  const id = useId();
  const ids = {
    lastUsed: `${id}-last`,
    location: `${id}-location`,
    status: `${id}-status`,
    details: `${id}-details`,
    modes: `${id}-modes`,
  };
  const describedBy = [lastUsed && ids.lastUsed, ids.location, ids.status, ids.details, ids.modes]
    .filter(Boolean)
    .join(' ');
  const localTime = now ? createClock(branch).time(now) : null;

  return (
    <article className={cx(styles.card, lastUsed && styles.isLastUsed)}>
      <BranchThumb branch={branch} />

      <div className={styles.head}>
        {lastUsed && (
          <span id={ids.lastUsed} className={styles.lastUsed}>
            <Icon name="history" size="xs" />
            {t('adminSelectBranch.card.lastUsed')}
          </span>
        )}
        <h2 className={styles.title}>
          <button
            type="button"
            className={styles.hit}
            aria-describedby={describedBy}
            onClick={() => onSelect(branch.id)}
          >
            {branch.shortName}
          </button>
        </h2>
        <p id={ids.location} className={styles.location}>
          {t('adminSelectBranch.card.location', {
            city: branch.city,
            country: t(`countryNames.${branch.country}`),
          })}
        </p>
      </div>

      <span id={ids.status} className={cx(styles.status, styles[branch.status])}>
        {t(`adminSelectBranch.card.status.${branch.status}`)}
      </span>

      <div id={ids.details} className={styles.details}>
        <p className={styles.row}>
          <Icon name="clock" size="xs" />
          <span>{t('adminSelectBranch.card.hoursToday', { hours: hoursToday })}</span>
          {localTime && (
            <span className={styles.now}>
              <span aria-hidden="true">{t('adminSelectBranch.card.now', { time: localTime })}</span>
              <span className="visually-hidden">
                {t('adminSelectBranch.card.nowLabel', { time: localTime })}
              </span>
            </span>
          )}
        </p>
        <p className={styles.row}>
          <Icon name="table" size="xs" />
          <span>
            {t('adminSelectBranch.card.tables', {
              first: branch.tables.first,
              last: branch.tables.last,
            })}
          </span>
          <span className={styles.currency}>
            <span aria-hidden="true">{branch.currencyCode}</span>
            <span className="visually-hidden">
              {t('adminSelectBranch.card.currency', { code: branch.currencyCode })}
            </span>
          </span>
        </p>
      </div>

      <div className={styles.foot}>
        <ul id={ids.modes} className={styles.modes} aria-label={t('adminSelectBranch.card.modes')}>
          {branch.modes.map((mode) => (
            <li key={mode} className={styles.mode}>
              <Icon name={MODE_ICONS[mode]} size="xs" />
              {t(`modes.${mode}`)}
            </li>
          ))}
        </ul>
        <span className={styles.go} aria-hidden="true">
          <Icon name="arrow" size="sm" />
        </span>
      </div>
    </article>
  );
}
