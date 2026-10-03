'use client';

import { Button, EmptyState, Icon, Skeleton, Tag } from '@/components/ui';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { useContent, useOrderHistory, useRestaurant } from '@/api/hooks';
import { useOrders } from '@/context/OrdersContext';
import { useFinishPlacedOrder } from '@/hooks/usePlaceOrder';
import { cx } from '@/lib/cx';
import { formatINR, formatTime } from '@/lib/format';
import { findOrder } from '@/lib/orders';
import type { Order } from '@/types/order';
import styles from './OrderConfirmed.module.css';

function PaymentTag({ order }: { order: Order }) {
  const t = useContent('orders');
  return order.payment.method === 'online' ? (
    <Tag variant="ok">{t('payment.paidOnline')}</Tag>
  ) : (
    <Tag variant="warn" icon={null}>
      {t('payment.payAtCounter')}
    </Tag>
  );
}

/** Order placed (13 · w13). */
export function OrderConfirmed({ id }: { id: string }) {
  const restaurant = useRestaurant();
  const t = useContent('orders');
  const { placed, hydrated } = useOrders();
  const history = useOrderHistory();
  useFinishPlacedOrder(id);
  const order = hydrated ? findOrder(id, placed, history) : undefined;

  if (!hydrated) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main
          id="main"
          className={styles.loading}
          aria-busy="true"
          aria-label={t('shared.loadingOrder')}
        >
          <Skeleton shape="circle" width={112} height={112} />
          <Skeleton shape="title" width={220} />
          <Skeleton shape="block" width="100%" height={240} />
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main id="main" className={styles.main}>
          <EmptyState
            icon="receipt"
            tone="neutral"
            as="h1"
            title={t('shell.notFound.title')}
            actions={<Button href="/menu/">{t('shared.backToMenu')}</Button>}
          >
            {t('shell.notFound.bodyShort', { id })}
          </EmptyState>
        </main>
      </div>
    );
  }

  const placedAt = formatTime(order.placedAt);
  const estimate = order.estimate ?? restaurant.prepTime;
  const trackHref = `/order/${order.id}/track/`;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main id="main" className={styles.main}>
        <div className={styles.art}>
          <Icon name="check" />
        </div>
        <div className={styles.head} role="status">
          <p className={cx('t-caption', styles.placed)}>{t('confirmed.placed')}</p>
          <h1 className={styles.title}>{t('shared.orderNumber', { id: order.id })}</h1>
          <p className={cx('t-body c2', styles.lede)}>{t('confirmed.lede')}</p>
        </div>

        <dl className={styles.wells} aria-label={t('confirmed.summary')}>
          <div className={styles.well}>
            <dt className="t-caption c3">{t('shared.tableLabel')}</dt>
            <dd>{t('shared.table', { table: order.table })}</dd>
          </div>
          <div className={styles.well}>
            <dt className="t-caption c3">{t('totals.total')}</dt>
            <dd>{formatINR(order.total)}</dd>
          </div>
          <div className={styles.well}>
            <dt className="t-caption c3">{t('payment.title')}</dt>
            <dd>
              <PaymentTag order={order} />
            </dd>
          </div>
          <div className={styles.well}>
            <dt className="t-caption c3">{t('confirmed.readyIn')}</dt>
            <dd>{estimate}</dd>
          </div>
        </dl>

        <div className={styles.progress}>
          <div className={styles.seg} aria-hidden="true">
            <i className={styles.cur} />
            <i />
            <i />
            <i />
          </div>
          <ol className={styles.segLabels} aria-label={t('shared.orderProgress')}>
            <li className={styles.on} aria-current="step">
              {t('steps.received')}
            </li>
            <li>{t('steps.preparing')}</li>
            <li>{t('steps.ready')}</li>
            <li>{t('steps.served')}</li>
          </ol>
        </div>

        <div className={styles.desktopActions}>
          <Button href={trackHref} iconEnd="arrow">
            {t('confirmed.trackOrder')}
          </Button>
          <Button href="/menu/" variant="secondary">
            {t('confirmed.orderMore')}
          </Button>
        </div>
        <p className={cx('t-small c3', styles.byline)}>
          {t('confirmed.byline', {
            restaurant: restaurant.name,
            time: placedAt,
            name: order.customerName,
          })}
        </p>
      </main>
      <div className={styles.foot}>
        <Button href={trackHref} block iconEnd="arrow">
          {t('confirmed.trackOrder')}
        </Button>
        <Button href="/menu/" block variant="secondary">
          {t('confirmed.orderMore')}
        </Button>
      </div>
    </div>
  );
}
