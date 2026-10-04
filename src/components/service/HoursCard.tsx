import { Icon } from '@/components/ui';
import { useBranch, useContent } from '@/api/hooks';
import { cx } from '@/lib/cx';
import styles from './HoursCard.module.css';

/** Opening hours: a compact well on mobile (17), a panel with every service window on web (w17). */
export function HoursCard() {
  const branch = useBranch();
  const t = useContent('service');
  return (
    <>
      <div className={cx(styles.well, 'hide-desktop')}>
        <Icon name="clock" size="sm" className={styles.wellIcon} />
        <p className={styles.wellText}>
          <b>{t('hours.openToday', { hours: branch.hoursToday })}</b>
          <span className="c2">{t('hours.lastOrdersAt', { time: branch.lastOrders })}</span>
        </p>
      </div>
      <section className={cx(styles.panel, 'hide-mobile')} aria-labelledby="opening-hours">
        <h2 id="opening-hours" className="t-h3">
          {t('hours.title')}
        </h2>
        <dl className={styles.rows}>
          {branch.serviceWindows.map((w) => (
            <div key={w.label} className={styles.row}>
              <dt>{w.label}</dt>
              <dd>{w.hours}</dd>
            </div>
          ))}
          <div className={styles.row}>
            <dt>{t('hours.lastKitchenOrder')}</dt>
            <dd>{branch.lastOrders}</dd>
          </div>
        </dl>
        <hr className={styles.hr} />
        <p className={cx('t-small c2', styles.address)}>
          <Icon name="pin" size="xs" className={styles.pin} />
          {branch.address}
        </p>
      </section>
    </>
  );
}
