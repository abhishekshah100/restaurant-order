'use client';

import { Button, EmptyState, Icon, Skeleton, Tag } from '@/components/ui';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { restaurant } from '@/data/restaurant';
import { useOrders } from '@/context/OrdersContext';
import { useFinishPlacedOrder } from '@/hooks/usePlaceOrder';
import { cx } from '@/lib/cx';
import { formatINR, formatTime } from '@/lib/format';
import { findOrder } from '@/lib/orders';
import type { Order } from '@/types/order';
import styles from './OrderConfirmed.module.css';

function PaymentTag({ order }: { order: Order }) {
  return order.payment.method === 'online' ? (
    <Tag variant="ok">Paid online</Tag>
  ) : (
    <Tag variant="warn" icon={null}>
      Pay at counter
    </Tag>
  );
}

/** Order placed (13 · w13). */
export function OrderConfirmed({ id }: { id: string }) {
  const { placed, hydrated } = useOrders();
  useFinishPlacedOrder(id);
  const order = hydrated ? findOrder(id, placed) : undefined;

  if (!hydrated) {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main id="main" className={styles.loading} aria-busy="true" aria-label="Loading order">
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
            title="Order not found"
            actions={<Button href="/menu/">Back to menu</Button>}
          >
            We couldn&apos;t find order #{id} on this device.
          </EmptyState>
        </main>
      </div>
    );
  }

  const placedAt = formatTime(order.placedAt);
  const estimate = order.estimate ?? '18–22 min';
  const trackHref = `/order/${order.id}/track/`;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main id="main" className={styles.main}>
        <div className={styles.art}>
          <Icon name="check" />
        </div>
        <div className={styles.head} role="status">
          <p className={cx('t-caption', styles.placed)}>Order placed</p>
          <h1 className={styles.title}>Order #{order.id}</h1>
          <p className={cx('t-body c2', styles.lede)}>
            Your order has been received and sent to the kitchen.
          </p>
        </div>

        <dl className={styles.card} aria-label="Order summary">
          <div className={styles.row}>
            <dt>Restaurant</dt>
            <dd>{restaurant.name}</dd>
          </div>
          <div className={styles.row}>
            <dt>Table</dt>
            <dd>Table {order.table}</dd>
          </div>
          <div className={styles.row}>
            <dt>Payment</dt>
            <dd>
              <PaymentTag order={order} />
            </dd>
          </div>
          <div className={styles.row}>
            <dt>Total</dt>
            <dd className={styles.big}>{formatINR(order.total)}</dd>
          </div>
          <div className={styles.row}>
            <dt>Estimated time</dt>
            <dd>
              <Icon name="clock" size="xs" />
              {estimate}
            </dd>
          </div>
        </dl>

        <dl className={styles.wells}>
          <div className={styles.well}>
            <dt className="t-caption c3">Table</dt>
            <dd>Table {order.table}</dd>
          </div>
          <div className={styles.well}>
            <dt className="t-caption c3">Total</dt>
            <dd>{formatINR(order.total)}</dd>
          </div>
          <div className={styles.well}>
            <dt className="t-caption c3">Payment</dt>
            <dd>
              <PaymentTag order={order} />
            </dd>
          </div>
          <div className={styles.well}>
            <dt className="t-caption c3">Ready in</dt>
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
          <ol className={styles.segLabels} aria-label="Order progress">
            <li className={styles.on} aria-current="step">
              Received
            </li>
            <li>Preparing</li>
            <li>Ready</li>
            <li>Served</li>
          </ol>
        </div>

        <div className={styles.desktopActions}>
          <Button href={trackHref} iconEnd="arrow">
            Track order
          </Button>
          <Button href="/menu/" variant="secondary">
            Order something else
          </Button>
        </div>
        <p className={cx('t-small c3', styles.byline)}>
          {restaurant.name} · Placed at {placedAt} by {order.customerName}
        </p>
      </main>
      <div className={styles.foot}>
        <Button href={trackHref} block iconEnd="arrow">
          Track order
        </Button>
        <Button href="/menu/" block variant="secondary">
          Order something else
        </Button>
      </div>
    </div>
  );
}
