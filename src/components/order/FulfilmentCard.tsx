'use client';

import { useBranch, useContent, useRegion } from '@/api/hooks';
import { Icon } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { Order } from '@/types/order';
import styles from './FulfilmentCard.module.css';

/**
 * Takeaway: where and when to collect, with directions (a plain maps link) and the
 * restaurant's number. Delivery: the address, when it's expected and, once out for delivery,
 * the rider with a "Call rider" link (to a masked relay number).
 */
export function FulfilmentCard({ order, className }: { order: Order; className?: string }) {
  const branch = useBranch();
  const { clock } = useRegion();
  const t = useContent('orders');

  if (order.mode === 'takeaway' && order.pickup) {
    const time = clock.time(order.pickup.at);
    return (
      <section className={cx(styles.card, className)} aria-labelledby="fulfilment-title">
        <h2 id="fulfilment-title" className={styles.title}>
          <Icon name="bag" size="sm" />
          {t('fulfilment.pickupTitle')}
        </h2>
        <div className={styles.place}>
          <p className={styles.name}>{branch.name}</p>
          <p className={styles.line}>{branch.address}</p>
          <p className={styles.when}>
            <Icon name="clock" size="xs" />
            {order.pickup.asap
              ? t('fulfilment.pickupAsap', { time })
              : t('fulfilment.pickupAt', { time })}
          </p>
        </div>
        <div className={styles.actions}>
          <a
            className={styles.button}
            href={branch.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('fulfilment.directionsLabel', { branch: branch.name })}
          >
            <Icon name="pin" size="xs" />
            {t('fulfilment.directions')}
          </a>
          <a className={styles.call} href={branch.phoneHref}>
            <Icon name="phone" size="xs" />
            {t('fulfilment.callRestaurant')}
          </a>
        </div>
      </section>
    );
  }

  if (order.mode === 'delivery' && order.delivery) {
    const { address, rider, expectedAt } = order.delivery;
    return (
      <section className={cx(styles.card, className)} aria-labelledby="fulfilment-title">
        <h2 id="fulfilment-title" className={styles.title}>
          <Icon name="scooter" size="sm" />
          {t('fulfilment.deliveryTitle')}
        </h2>
        <div className={styles.place}>
          <p className={styles.name}>
            <span className={styles.label}>{t(`fulfilment.addressLabel.${address.label}`)}</span>
            {address.area}
          </p>
          <p className={styles.line}>{address.line}</p>
          {address.landmark && (
            <p className={styles.line}>{t('fulfilment.landmark', { landmark: address.landmark })}</p>
          )}
          {address.instructions && (
            <p className={cx(styles.line, styles.note)}>
              {t('fulfilment.instructions', { text: address.instructions })}
            </p>
          )}
          {order.status !== 'delivered' && (
            <p className={styles.when}>
              <Icon name="clock" size="xs" />
              {t('fulfilment.expected', { time: clock.time(expectedAt) })}
            </p>
          )}
        </div>
        {rider ? (
          <div className={styles.rider}>
            <span className={styles.riderIcon} aria-hidden="true">
              <Icon name="user" size="sm" />
            </span>
            <span className={styles.riderText}>
              <span className="t-caption c3">{t('fulfilment.riderTitle')}</span>
              <span className={styles.riderName}>{rider.name}</span>
              <span className={styles.riderPhone}>{rider.phone}</span>
            </span>
            <a
              className={cx(styles.button, styles.primary)}
              href={rider.callHref}
              aria-label={t('fulfilment.callRiderLabel', { name: rider.name })}
            >
              <Icon name="phone" size="xs" />
              {t('fulfilment.callRider')}
            </a>
          </div>
        ) : (
          order.status !== 'delivered' && (
            <p className={styles.soon}>{t('fulfilment.riderSoon')}</p>
          )
        )}
      </section>
    );
  }

  return null;
}
