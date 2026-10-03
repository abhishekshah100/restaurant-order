'use client';

import { Button, StatusPill, Tag, VegMark } from '@/components/ui';
import { PriceSummary } from '@/components/cart/PriceSummary';
import { Breadcrumbs } from '@/components/menu/Breadcrumbs';
import { useContent, useRestaurant } from '@/api/hooks';
import type { ContentMap } from '@/api/queries';
import type { Translator } from '@/api/translator';
import { cx } from '@/lib/cx';
import { formatINR, formatTime } from '@/lib/format';
import { formatOrderDay, isFinished, orderBill } from '@/lib/orders';
import { itemCount } from '@/lib/pricing';
import type { Order } from '@/types/order';
import { OrderCancelled } from './OrderCancelled';
import { OrderLoading, OrderNotFound, OrderShell } from './OrderShell';
import { useLiveOrder } from './useLiveOrders';
import styles from './OrderDetails.module.css';

function PaymentStatusTag({ order }: { order: Order }) {
  const t = useContent('orders');
  switch (order.payment.status) {
    case 'paid':
      return <Tag variant="ok">{t('payment.paid')}</Tag>;
    case 'refunded':
      return <Tag variant="ok">{t('payment.refunded')}</Tag>;
    case 'refund-started':
      return (
        <Tag variant="warn" icon={null}>
          {t('payment.refundStarted')}
        </Tag>
      );
    default:
      return (
        <Tag variant="warn" icon={null}>
          {order.payment.method === 'counter' ? t('payment.payAtCounter') : t('payment.unpaid')}
        </Tag>
      );
  }
}

function trackLabel(order: Order, t: Translator<ContentMap['orders']>): string {
  if (isFinished(order)) return t('details.viewTimeline');
  return order.etaMinutes
    ? t('details.trackLiveEta', { minutes: order.etaMinutes })
    : t('details.trackLive');
}

function DetailsView({ order, now }: { order: Order; now: Date }) {
  const restaurant = useRestaurant();
  const t = useContent('orders');
  const { payment } = order;
  const method =
    payment.detail ??
    (payment.method === 'online' ? t('payment.methodUpi') : t('payment.payAtCounter'));

  return (
    <OrderShell title={t('details.title')} className={styles.layout}>
      <div className={styles.col}>
        <Breadcrumbs
          items={[
            { label: t('shared.myOrders'), href: '/orders/' },
            { label: t('shared.orderRef', { id: order.id }) },
          ]}
        />
        <div className={styles.head}>
          <div className={styles.headText}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>
                {t.rich(
                  'details.heading',
                  { hidden: (c) => <span className="visually-hidden">{c}</span> },
                  { id: order.id },
                )}
              </h1>
              <StatusPill status={order.status} />
            </div>
            <p className={styles.meta}>
              {t('details.meta', {
                restaurant: restaurant.name,
                table: order.table,
                day: formatOrderDay(order.placedAt, now, t('details.today')),
                time: formatTime(order.placedAt),
                name: order.customerName,
              })}
            </p>
          </div>
          <Button
            href={`/order/${order.id}/track/`}
            variant="secondary"
            size="sm"
            iconStart="clock"
            className={styles.track}
          >
            {trackLabel(order, t)}
          </Button>
        </div>

        <section className={cx(styles.card, styles.items)} aria-labelledby="items-heading">
          <h2 id="items-heading" className={styles.itemsTitle}>
            {t('details.items', { count: itemCount(order.items) })}
          </h2>
          <div className={styles.thead} aria-hidden="true">
            <span>{t('details.columns.item')}</span>
            <span>{t('details.columns.qty')}</span>
            <span>{t('details.columns.price')}</span>
          </div>
          <ul className={styles.list}>
            {order.items.map((item, i) => (
              <li key={`${item.dishSlug}-${i}`} className={styles.row}>
                <div className={styles.body}>
                  <p className={styles.name}>
                    <VegMark veg={item.veg} />
                    {item.name}
                  </p>
                  {item.details.length > 0 && (
                    <p className={styles.opts}>
                      {item.details.map((d) => (
                        <span key={d}>{d}</span>
                      ))}
                    </p>
                  )}
                  {item.note && (
                    <p className={styles.note}>{t('shared.quoted', { text: item.note })}</p>
                  )}
                </div>
                <span className={styles.qty}>
                  <span className="visually-hidden">{t('details.quantity')}</span>
                  <span className="hide-desktop" aria-hidden="true">
                    ×{' '}
                  </span>
                  {item.quantity}
                </span>
                <span className={styles.price}>{formatINR(item.unitPrice * item.quantity)}</span>
              </li>
            ))}
          </ul>
          {order.kitchenNote && (
            <p className={styles.kitchenNote}>
              <span className="t-caption c3">{t('details.kitchenNote')}</span>
              {t('shared.quoted', { text: order.kitchenNote })}
            </p>
          )}
        </section>
      </div>

      <aside className={styles.aside}>
        <section className={cx(styles.card, styles.bill)} aria-labelledby="bill-heading">
          <h2 id="bill-heading" className="t-h3">
            {t('details.bill')}
          </h2>
          <PriceSummary bill={orderBill(order)} variant="receipt" totalLabel={t('totals.total')} />
        </section>

        <section className={cx(styles.card, styles.payment)} aria-labelledby="payment-heading">
          <h2 id="payment-heading" className={cx('t-h3', styles.paymentTitle)}>
            {t('payment.title')}
          </h2>
          <dl className={styles.rows}>
            <div className={styles.rowCenter}>
              <dt>{t('shared.status')}</dt>
              <dd>
                <PaymentStatusTag order={order} />
              </dd>
            </div>
            <div>
              <dt>{t('details.method')}</dt>
              <dd>{method}</dd>
            </div>
            {payment.transactionRef && (
              <div>
                <dt>{t('details.transactionId')}</dt>
                <dd>{payment.transactionRef}</dd>
              </div>
            )}
            {payment.refundAmount !== undefined && (
              <div>
                <dt>{t('details.refund')}</dt>
                <dd>{formatINR(payment.refundAmount)}</dd>
              </div>
            )}
          </dl>
        </section>

        <div className={styles.actions}>
          <Button variant="secondary" block iconStart="receipt" onClick={() => window.print()}>
            {t('details.invoice')}
          </Button>
          <Button href="/help/" variant="ghost" block iconStart="flag">
            {t('details.reportIssue')}
          </Button>
        </div>
      </aside>
    </OrderShell>
  );
}

/** Order details (15 · w15); the cancelled state (s10 · ws10) for cancelled orders. */
export function OrderDetails({ id }: { id: string }) {
  const t = useContent('orders');
  const lookup = useLiveOrder(id);
  if (lookup.state === 'loading') return <OrderLoading title={t('details.title')} />;
  if (lookup.state === 'missing') return <OrderNotFound id={id} />;
  if (lookup.order.status === 'cancelled') return <OrderCancelled order={lookup.order} />;
  return <DetailsView order={lookup.order} now={lookup.now} />;
}
