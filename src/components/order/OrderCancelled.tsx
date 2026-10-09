'use client';

import { Banner, Button, StatusPill } from '@/components/ui';
import { Breadcrumbs } from '@/components/menu/Breadcrumbs';
import { cx } from '@/lib/cx';
import { useContent, useMenu, useRegion } from '@/api/hooks';
import type { ContentMap } from '@/api/queries';
import type { Translator } from '@/api/translator';
import type { Money } from '@/lib/money';
import type { Order } from '@/types/order';
import { OrderShell } from './OrderShell';
import { TrackTimeline, type TimelineEntry } from './TrackTimeline';
import styles from './OrderCancelled.module.css';

/** Words and formatting the refund line needs. */
interface RefundCopy {
  t: Translator<ContentMap['orders']>;
  money: Money;
  /** Name of an online method the order doesn't record ("UPI"). */
  onlineName: string;
}

function refundText({ payment, total }: Order, { t, money, onlineName }: RefundCopy): string {
  const amount = money.format(payment.refundAmount ?? total);
  const to =
    payment.method === 'online'
      ? t('cancelled.refund.toAccount', { method: payment.detail ?? onlineName })
      : t('cancelled.refund.toYou');
  if (payment.status === 'refund-started') return t('cancelled.refund.started', { amount, to });
  if (payment.status === 'refunded') return t('cancelled.refund.done', { amount, to });
  return t('cancelled.refund.notCharged');
}

/** Order cancelled by the restaurant (s10 · ws10), or by the guest within the change window. */
export function OrderCancelled({ order }: { order: Order }) {
  const menu = useMenu();
  const t = useContent('orders');
  const common = useContent('common');
  const { money } = useRegion();
  const refundCopy = { t, money, onlineName: common('paymentMethods.online') };
  const byGuest = order.cancelledBy === 'guest';
  const received = order.timeline.find((e) => e.status === 'received');
  const cancelled = order.timeline.find((e) => e.status === 'cancelled');
  const entries: TimelineEntry[] = [
    {
      key: 'received',
      title: t('cancelled.orderReceived'),
      detail: [received?.time, received?.note].filter(Boolean).join(' · '),
      icon: 'check',
      state: 'done',
    },
    {
      key: 'cancelled',
      title: byGuest ? t('cancelled.cancelledByYou') : t('cancelled.cancelledByRestaurant'),
      detail: [cancelled?.time, cancelled?.note].filter(Boolean).join(' · '),
      icon: 'x',
      state: 'cancel',
    },
  ];
  const category = menu.getDish(order.items[0]?.dishSlug ?? '')?.categoryId;
  const menuHref = category ? `/menu/${category}/` : '/menu/';

  const actions = (
    <>
      <Button href={menuHref}>{t('cancelled.chooseAnother')}</Button>
      <Button href="/help/" variant="secondary" iconStart="phone">
        {t('cancelled.contactRestaurant')}
      </Button>
    </>
  );

  return (
    <OrderShell title={t('shared.orderNumber', { id: order.id })} className={styles.layout}>
      <div className={styles.col}>
        <Breadcrumbs
          items={[
            { label: t('shared.myOrders'), href: '/orders/' },
            { label: t('shared.orderRef', { id: order.id }) },
          ]}
        />
        <section className={cx(styles.panel, styles.hero)} role="alert">
          <StatusPill status="cancelled" className={styles.pill} />
          <h1 className={styles.title}>
            {byGuest ? t('cancelled.titleGuest') : t('cancelled.title')}
          </h1>
          <p className="t-body c2">
            {order.cancelReason ?? (byGuest ? t('cancelled.bodyGuest') : t('cancelled.sorry'))}
          </p>
          <Banner tone="ok" className={cx(styles.banner, 'hide-mobile')}>
            {refundText(order, refundCopy)}
          </Banner>
          <div className={cx(styles.actions, 'hide-mobile')}>{actions}</div>
        </section>
      </div>

      <aside className={cx(styles.panel, styles.aside)} aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="t-h3 hide-mobile">
          {t('timeline.title')}
        </h2>
        <TrackTimeline entries={entries} className={styles.timeline} label={t('timeline.label')} />
        <hr className={cx(styles.hr, 'hide-mobile')} />
        <ul className={cx(styles.lines, 'hide-mobile')} aria-label={t('cancelled.items')}>
          {order.items.map((item, i) => (
            <li key={`${item.dishSlug}-${i}`}>
              <span>
                {item.quantity} × {item.name}
              </span>
              <b>{money.format(item.unitPrice * item.quantity)}</b>
            </li>
          ))}
        </ul>
      </aside>

      <Banner tone="ok" className="hide-desktop">
        {refundText(order, refundCopy)}
      </Banner>
      <div className={cx(styles.foot, 'hide-desktop')}>{actions}</div>
    </OrderShell>
  );
}
