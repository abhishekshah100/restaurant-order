'use client';

import { Button, EmptyState, Icon, Skeleton, Tag } from '@/components/ui';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { useFinishPlacedOrder } from '@/hooks/usePlaceOrder';
import { cx } from '@/lib/cx';
import { TRACK_STEPS, orderPath, stepKey, unpaidLabel } from '@/lib/orders';
import type { Order } from '@/types/order';
import { ChangeWindow } from './ChangeWindow';
import { OrderSavings } from './OrderSavings';
import { OrderCancelled } from './OrderCancelled';
import { useLiveOrder } from './useLiveOrders';
import { useOrderId } from './useOrderId';
import styles from './OrderConfirmed.module.css';

function PaymentTag({ order }: { order: Order }) {
  const t = useContent('orders');
  return order.payment.method === 'online' ? (
    <Tag variant="ok">{t('payment.paidOnline')}</Tag>
  ) : (
    <Tag variant="warn" icon={null}>
      {t(`payment.${unpaidLabel(order.payment.method)}`)}
    </Tag>
  );
}

/** The first and last summary wells: the table and kitchen time (dine-in), the pickup time, or the delivery area and ETA. */
function useModeWells(order: Order): { first: [string, string]; last: [string, string] } {
  const branch = useBranch();
  const { clock } = useRegion();
  const t = useContent('orders');
  const common = useContent('common');
  if (order.mode === 'takeaway' && order.pickup) {
    return {
      first: [t('confirmed.mode'), common('modes.takeaway')],
      last: [t('confirmed.pickupAt'), clock.time(order.pickup.at)],
    };
  }
  if (order.mode === 'delivery' && order.delivery) {
    return {
      first: [t('confirmed.deliverTo'), order.delivery.address.area],
      last: [t('confirmed.arrivesIn'), t('shared.minutes', { minutes: order.etaMinutes ?? 1 })],
    };
  }
  return {
    first: [t('shared.tableLabel'), t('shared.table', { table: order.table ?? '' })],
    last: [t('confirmed.readyIn'), order.estimate ?? branch.prepTime],
  };
}

/**
 * Order placed (13 · w13); takeaway and delivery show their pickup time or area and ETA. While
 * the change window is open the guest can change or cancel it here.
 */
export function OrderConfirmed() {
  const t = useContent('orders');
  const id = useOrderId();
  const lookup = useLiveOrder(id);
  useFinishPlacedOrder(id);

  if (lookup.state === 'loading') {
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

  if (lookup.state === 'missing') {
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
            {id ? t('shell.notFound.bodyShort', { id }) : t('shell.notFound.bodyShortNoId')}
          </EmptyState>
        </main>
      </div>
    );
  }

  // Cancelled from here, within the change window.
  if (lookup.order.status === 'cancelled') return <OrderCancelled order={lookup.order} />;
  return <Confirmed order={lookup.order} />;
}

function Confirmed({ order }: { order: Order }) {
  const branch = useBranch();
  const { money, clock } = useRegion();
  const t = useContent('orders');
  const wells = useModeWells(order);
  const placedAt = clock.time(order.placedAt);
  const trackHref = orderPath(order.id, 'track');
  const steps = TRACK_STEPS[order.mode];

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
            <dt className="t-caption c3">{wells.first[0]}</dt>
            <dd>{wells.first[1]}</dd>
          </div>
          <div className={styles.well}>
            <dt className="t-caption c3">{t('totals.total')}</dt>
            <dd>{money.format(order.total)}</dd>
          </div>
          <div className={styles.well}>
            <dt className="t-caption c3">{t('payment.title')}</dt>
            <dd>
              <PaymentTag order={order} />
            </dd>
          </div>
          <div className={styles.well}>
            <dt className="t-caption c3">{wells.last[0]}</dt>
            <dd>{wells.last[1]}</dd>
          </div>
        </dl>

        <OrderSavings order={order} className={styles.saved} />

        <ChangeWindow order={order} className={styles.change} />

        <div className={styles.progress}>
          <div className={styles.seg} aria-hidden="true">
            <i className={styles.cur} />
            <i />
            <i />
            <i />
          </div>
          <ol className={styles.segLabels} aria-label={t('shared.orderProgress')}>
            {steps.map((step, i) => (
              <li
                key={step}
                className={i === 0 ? styles.on : undefined}
                aria-current={i === 0 ? 'step' : undefined}
              >
                {t(`steps.${stepKey(order.mode, step)}`)}
              </li>
            ))}
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
            restaurant: branch.name,
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
