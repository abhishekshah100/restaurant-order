'use client';

import Link from 'next/link';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import type { ContentMap } from '@/api/queries';
import type { Translator } from '@/api/translator';
import { Icon, StatusPill, type IconName } from '@/components/ui';
import { Breadcrumbs } from '@/components/menu/Breadcrumbs';
import { cx } from '@/lib/cx';
import { useNow } from '@/hooks/useNow';
import { useVisitWords } from '@/hooks/useVisitLabel';
import {
  isFinished,
  paymentProgress,
  stepKey,
  totalLabel,
  trackSteps,
  type TrackStep,
  type TrackStepView,
} from '@/lib/orders';
import type { Order } from '@/types/order';
import { FulfilmentCard } from './FulfilmentCard';
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
  pickedUp: 'bag',
  outForDelivery: 'scooter',
  delivered: 'pin',
};

type OrdersCopy = Translator<ContentMap['orders']>;

/**
 * Short line under a step: "8:23 PM", "Up next", "~8:41 PM", "At Table 12", "At the counter".
 * The current step shows just its start time; the status card above already says what's
 * happening.
 */
function stepDetail(
  { step, state, time }: TrackStepView,
  order: Order,
  t: OrdersCopy,
  prepTime: string,
): string | undefined {
  if (state === 'next') return t('tracking.upNext');
  if (state !== 'upcoming') return time;
  if (step === 'served') return t('tracking.atTable', { table: order.table ?? '' });
  if (step === 'pickedUp') return t('tracking.atCounter');
  // Delivery: when the rider sets off isn't promised, only when it arrives.
  if (step === 'outForDelivery') return undefined;
  return order.readyBy
    ? t('tracking.readyBy', { time: order.readyBy })
    : t('tracking.inAbout', { estimate: order.estimate ?? prepTime });
}

interface Hero {
  label: string;
  value: string;
  body: string;
}

/** Headline block of the status card for a dine-in order. */
function dineInHero(order: Order, timeOf: (step: TrackStep) => string, t: OrdersCopy, prepTime: string): Hero {
  const table = order.table ?? '';
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

/** Headline block for a takeaway order: when it's ready to collect, then that it's collected. */
function takeawayHero(order: Order, timeOf: (step: TrackStep) => string, t: OrdersCopy, branch: string): Hero {
  switch (order.status) {
    case 'ready':
      return {
        label: t('tracking.takeaway.readyLabel'),
        value: t('steps.readyForPickup'),
        body: t('tracking.takeaway.readyBody', { time: timeOf('ready'), id: order.id }),
      };
    case 'pickedUp':
      return {
        label: t('tracking.takeaway.pickedUpLabel'),
        value: t('steps.pickedUp'),
        body: t('tracking.takeaway.pickedUpBody', { time: timeOf('pickedUp'), branch }),
      };
    default:
      return {
        label: t('tracking.takeaway.readyAtLabel'),
        value: order.readyBy ?? '',
        body:
          order.status === 'preparing'
            ? t('tracking.takeaway.preparingBody', { time: timeOf('preparing') })
            : t('tracking.takeaway.receivedBody'),
      };
  }
}

/** Headline block for a delivery: a live countdown to the door, the rider, then delivered. */
function deliveryHero(
  order: Order,
  timeOf: (step: TrackStep) => string,
  t: OrdersCopy,
  minutes: number,
): Hero {
  const area = order.delivery?.address.area ?? '';
  if (order.status === 'delivered') {
    return {
      label: t('tracking.delivery.deliveredLabel'),
      value: t('steps.delivered'),
      body: t('tracking.delivery.deliveredBody', { area, time: timeOf('delivered') }),
    };
  }
  let body = t('tracking.delivery.receivedBody', { area });
  if (order.status === 'preparing') {
    body = t('tracking.delivery.preparingBody', { time: timeOf('preparing') });
  } else if (order.status === 'outForDelivery') {
    body = t('tracking.delivery.outBody', {
      rider: order.delivery?.rider?.name ?? '',
      time: timeOf('outForDelivery'),
      area,
    });
  }
  return {
    label: t('tracking.delivery.etaLabel'),
    value: t('shared.minutes', { minutes }),
    body,
  };
}

/** Minutes until a delivery is expected at the door, counting down between server reads. */
function useArrivalMinutes(order: Order): number {
  const now = useNow(15_000);
  const expected = order.delivery ? Date.parse(order.delivery.expectedAt) : NaN;
  if (!now || Number.isNaN(expected)) return order.etaMinutes ?? 1;
  return Math.max(1, Math.ceil((expected - now.getTime()) / 60_000));
}

/** "Live · updated just now" only while the order really refreshes; otherwise when it was read. */
function Freshness({ live, now }: { live: boolean; now: Date }) {
  const t = useContent('orders');
  const { clock } = useRegion();
  return (
    <span className={cx(styles.live, live && styles.isLive)}>
      <span className={styles.liveDot} aria-hidden="true" />
      {live ? t('tracking.live') : t('tracking.updated', { time: clock.time(now) })}
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
  const branch = useBranch();
  const { prepTime } = branch;
  const { money, clock } = useRegion();
  const visitWords = useVisitWords();
  const arrival = useArrivalMinutes(order);
  const timeOf = (step: TrackStep) => String(steps.find((s) => s.step === step)?.time);
  let hero: Hero;
  if (order.mode === 'takeaway') hero = takeawayHero(order, timeOf, t, branch.shortName);
  else if (order.mode === 'delivery') hero = deliveryHero(order, timeOf, t, arrival);
  else hero = dineInHero(order, timeOf, t, prepTime);
  const progress: StepperEntry[] = steps.map((s) => ({
    key: s.step,
    title: t(`steps.${stepKey(order.mode, s.step)}`),
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
        {t('tracking.statusAnnouncement', {
          status: t(`steps.${stepKey(order.mode, order.status as TrackStep)}`),
        })}
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

        {order.mode === 'dineIn' ? <OrderActions /> : <FulfilmentCard order={order} />}
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
          <span className={styles.totalAmt}>{money.format(order.total)}</span>
        </div>
        <p className={cx('t-small c3', styles.meta)}>
          {t('tracking.meta', {
            visit: visitWords(order),
            time: clock.time(order.placedAt),
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
  return <TrackingView order={order} finished={isFinished(order)} live={live} now={now} />;
}
