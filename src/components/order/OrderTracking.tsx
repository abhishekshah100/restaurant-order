'use client';

import Link from 'next/link';
import { useContent, useRestaurant } from '@/api/hooks';
import type { ContentMap } from '@/api/queries';
import type { Translator } from '@/api/translator';
import { Icon, StatusPill, type IconName } from '@/components/ui';
import { Breadcrumbs } from '@/components/menu/Breadcrumbs';
import { cx } from '@/lib/cx';
import { formatINR, formatTime } from '@/lib/format';
import {
  paymentProgress,
  totalLabel,
  trackSteps,
  type TrackStep,
  type TrackStepView,
} from '@/lib/orders';
import type { Order } from '@/types/order';
import { ItemStatusList } from './ItemStatusList';
import { OrderActions } from './OrderActions';
import { OrderCancelled } from './OrderCancelled';
import { OrderLoading, OrderNotFound, OrderShell } from './OrderShell';
import { TrackStepper, type StepperEntry } from './TrackStepper';
import { useLiveOrder } from './useLiveOrders';
import styles from './OrderTracking.module.css';

const STEP_ICON: Record<TrackStep, IconName> = {
  received: 'check',
  preparing: 'flame',
  ready: 'cloche',
  served: 'cutlery',
};

type OrdersCopy = Translator<ContentMap['orders']>;

/**
 * Short line under a step: "8:23 PM", "Up next", "~8:41 PM", "At Table 12". The current
 * step shows just its start time; the status card above already says what's happening.
 */
function stepDetail(
  { step, state, time }: TrackStepView,
  order: Order,
  t: OrdersCopy,
  prepTime: string,
) {
  if (state === 'next') return t('tracking.upNext');
  if (state === 'upcoming') {
    if (step === 'served') return t('tracking.atTable', { table: order.table });
    return order.readyBy
      ? t('tracking.readyBy', { time: order.readyBy })
      : t('tracking.inAbout', { estimate: order.estimate ?? prepTime });
  }
  return time;
}

/** Headline block of the status card. */
function heroCopy(order: Order, steps: TrackStepView[], t: OrdersCopy, prepTime: string) {
  const timeOf = (step: TrackStep) => String(steps.find((s) => s.step === step)?.time);
  const table = order.table;
  switch (order.status) {
    case 'ready':
      return {
        label: t('tracking.hero.readyLabel'),
        value: t('steps.ready'),
        body: t('tracking.hero.readyBody', { time: timeOf('ready'), table }),
      };
    case 'served':
      return {
        label: t('tracking.hero.servedLabel'),
        value: t('steps.served'),
        body: t('tracking.hero.servedBody', { time: timeOf('served'), table }),
      };
    default:
      return {
        label: order.etaMinutes ? t('tracking.hero.etaLabel') : t('tracking.hero.estimateLabel'),
        value: order.etaMinutes
          ? t('shared.minutes', { minutes: order.etaMinutes })
          : (order.estimate ?? prepTime),
        body:
          order.status === 'preparing'
            ? t('tracking.hero.preparingBody', { time: timeOf('preparing'), table })
            : t('tracking.hero.receivedBody', { table }),
      };
  }
}

/** "Live · updated just now" only while the order really refreshes; otherwise when it was read. */
function Freshness({ live, now }: { live: boolean; now: Date }) {
  const t = useContent('orders');
  return (
    <span className={cx(styles.live, live && styles.isLive)}>
      <span className={styles.liveDot} aria-hidden="true" />
      {live ? t('tracking.live') : t('tracking.updated', { time: formatTime(now) })}
    </span>
  );
}

function TrackingView({
  order,
  finished,
  live,
  now,
}: {
  order: Order;
  finished: boolean;
  live: boolean;
  now: Date;
}) {
  const t = useContent('orders');
  const steps = trackSteps(order);
  const { prepTime } = useRestaurant();
  const hero = heroCopy(order, steps, t, prepTime);
  const progress: StepperEntry[] = steps.map((s) => ({
    key: s.step,
    title: t(`steps.${s.step}`),
    detail: stepDetail(s, order, t, prepTime),
    icon: STEP_ICON[s.step],
    state: s.state,
  }));
  const currentNote = steps.find((s) => s.state === 'current' && s.step !== 'received')?.note;
  const detailsHref = `/order/${order.id}/`;

  return (
    <OrderShell title={t('shared.orderNumber', { id: order.id })} className={styles.layout}>
      <h1 className="visually-hidden">{t('tracking.heading', { id: order.id })}</h1>
      <p className="visually-hidden" aria-live="polite">
        {t('tracking.statusAnnouncement', { status: t(`steps.${order.status as TrackStep}`) })}
      </p>
      <div className={styles.col}>
        <Breadcrumbs
          items={[
            { label: t('shared.myOrders'), href: '/orders/' },
            { label: t('shared.orderRef', { id: order.id }) },
          ]}
        />

        <section className={cx(styles.card, styles.hero)} aria-label={t('shared.orderStatus')}>
          <StatusPill status={order.status} className={styles.heroPill} />
          {!finished && <Freshness live={live} now={now} />}
          <div className={styles.eta}>
            <span className="t-small c2">{hero.label}</span>
            <span className={styles.etaValue}>{hero.value}</span>
            <span className={cx('t-body c2', styles.etaBody)}>{hero.body}</span>
          </div>
        </section>

        <TrackStepper entries={progress} note={currentNote} />

        <OrderActions />
      </div>

      <aside className={cx(styles.card, styles.items)} aria-labelledby="items-heading">
        <div className={styles.itemsHead}>
          <h2 id="items-heading" className={styles.itemsTitle}>
            <span className="hide-desktop">{t('tracking.yourItems')}</span>
            <span className="hide-mobile">{t('shared.orderNumber', { id: order.id })}</span>
          </h2>
          <Link
            href={detailsHref}
            className={styles.link}
            aria-label={t('tracking.detailsLabel', { id: order.id })}
          >
            {t('tracking.details')}
            <Icon name="chev" size="xs" />
          </Link>
        </div>
        <ItemStatusList order={order} />
        <div className={styles.total}>
          <span className={styles.totalLabel}>{t(`totals.${totalLabel(order)}`)}</span>
          <span className={styles.totalAmt}>{formatINR(order.total)}</span>
        </div>
        <p className={cx('t-small c3', styles.meta)}>
          {t('tracking.meta', {
            table: order.table,
            time: formatTime(order.placedAt),
            payment: t(`payment.${paymentProgress(order)}`),
          })}
        </p>
      </aside>
    </OrderShell>
  );
}

/** Live order tracking (14 · w14); the cancelled state (s10 · ws10) for cancelled orders. */
export function OrderTracking({ id }: { id: string }) {
  const t = useContent('orders');
  const lookup = useLiveOrder(id);
  if (lookup.state === 'loading') return <OrderLoading title={t('shared.orderNumber', { id })} />;
  if (lookup.state === 'missing') return <OrderNotFound id={id} />;
  const { order, live, now } = lookup;
  if (order.status === 'cancelled') return <OrderCancelled order={order} />;
  return <TrackingView order={order} finished={order.status === 'served'} live={live} now={now} />;
}
