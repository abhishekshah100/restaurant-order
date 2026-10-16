import type { CSSProperties } from 'react';
import { useContent } from '@/api/hooks';
import { useAdminWorkspace } from '@/components/admin/shell/AdminWorkspace';
import { cx } from '@/lib/cx';
import { hourLabel, type HourCount } from '@/lib/kitchenActivity';
import styles from './ActivityCharts.module.css';

/**
 * Tickets by the hour they reached the kitchen: one bar per hour from the first to the last,
 * the count on top of each, the busiest hour darker and named. Each bar is a list item with its
 * full reading for screen readers; hovering or focusing one shows tickets and items.
 */
export function HourChart({
  hours,
  busiest,
}: {
  hours: readonly HourCount[];
  busiest: HourCount | null;
}) {
  const t = useContent('kitchen');
  const { region } = useAdminWorkspace();
  const max = Math.max(1, ...hours.map((h) => h.tickets));

  return (
    <section className={styles.card} aria-labelledby="kitchen-hours">
      <header className={styles.head}>
        <h2 id="kitchen-hours" className={styles.title}>
          {t('activity.hours.title')}
        </h2>
        <p className={styles.subtitle}>
          {busiest
            ? t('activity.hours.busiest', { hour: hourLabel(busiest.hour, region) })
            : t('activity.hours.subtitle')}
        </p>
      </header>
      {hours.length > 0 ? (
        <ol className={styles.columns}>
          {hours.map((h) => {
            const hour = hourLabel(h.hour, region);
            return (
              <li
                key={h.hour}
                className={cx(styles.column, busiest?.hour === h.hour && styles.peak)}
                // The bar's height is the hour's share of the busiest hour.
                style={{ '--value': `${(h.tickets / max) * 100}%` } as CSSProperties}
                tabIndex={0}
                aria-label={t('activity.hours.bar', { hour, tickets: h.tickets, items: h.items })}
              >
                <span className={styles.plot} aria-hidden="true">
                  <span className={styles.count}>{h.tickets > 0 ? h.tickets : ''}</span>
                  <span className={styles.bar} />
                  <span className={styles.tooltip}>
                    {t('activity.hours.tooltip', { tickets: h.tickets, items: h.items })}
                  </span>
                </span>
                <span className={styles.axis} aria-hidden="true">
                  {hour}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className={styles.empty}>{t('activity.hours.empty')}</p>
      )}
    </section>
  );
}
