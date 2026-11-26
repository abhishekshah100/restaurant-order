'use client';

import type { BillingCycle, PackagePlan } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { Tag } from '@/components/ui';
import { rupees } from '@/lib/platform';
import styles from './Platform.module.css';

/** The packages as cards, one picked (radio buttons: arrow keys move between them). */
export function PackagePicker({
  packages,
  value,
  current,
  cycle,
  onPick,
}: {
  packages: PackagePlan[];
  value: string;
  /** The client's package as saved (marked "Current"). */
  current: string;
  cycle: BillingCycle;
  onPick: (pkg: PackagePlan) => void;
}) {
  const t = useContent('common');
  const limit = (n: number | null) => (n === null ? t('platform.limits.infinity') : String(n));
  return (
    <div className={styles.packages} role="radiogroup" aria-label={t('platform.package.title')}>
      {packages.map((p) => {
        const price = cycle === 'yearly' ? p.prices.yearly : p.prices.halfYearly;
        return (
          <label key={p.code} className={styles.package}>
            <input
              type="radio"
              name="package"
              value={p.code}
              checked={value === p.code}
              onChange={() => onPick(p)}
            />
            <span className={styles.packageName}>
              {p.name}
              {p.code === current && <Tag variant="plain">{t('platform.package.current')}</Tag>}
            </span>
            <span className={styles.packagePrice}>
              {price === null
                ? t('platform.package.onRequest')
                : price === 0
                  ? t('platform.package.free')
                  : t(`platform.package.${cycle}`, { price: rupees(price) })}
            </span>
            <span className={styles.packageLimits}>
              {t('platform.package.limits', {
                staff: limit(p.limits.staff),
                tables: limit(p.limits.tables),
                dishes: limit(p.limits.dishes),
              })}
            </span>
          </label>
        );
      })}
    </div>
  );
}
