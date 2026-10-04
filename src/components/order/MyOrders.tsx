'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button, EmptyState, Icon, Skeleton, StatusPill } from '@/components/ui';
import { BottomNav } from '@/components/layout/BottomNav';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Page } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { cx } from '@/lib/cx';
import { useVisitWords } from '@/hooks/useVisitLabel';
import { formatPlaced, groupByVisit, isFinished, paymentLabel, spentTotal } from '@/lib/orders';
import { itemCount } from '@/lib/pricing';
import type { Order } from '@/types/order';
import { ModeBadge } from './ModeBadge';
import { OrderThumb } from './OrderThumb';
import { useLiveOrderList } from './useLiveOrders';
import styles from './MyOrders.module.css';

const orderHref = (order: Order) =>
  isFinished(order) ? `/order/${order.id}/` : `/order/${order.id}/track/`;

function OrderStatus({ order, className }: { order: Order; className?: string }) {
  const t = useContent('orders');
  return (
    <StatusPill status={order.status} className={className}>
      {order.etaMinutes && !isFinished(order)
        ? t('list.statusEta', {
            status: order.status === 'received' ? t('steps.received') : t('steps.preparing'),
            minutes: order.etaMinutes,
          })
        : undefined}
    </StatusPill>
  );
}

/** One order: a list row (or a highlighted card while active) on mobile, a table row on the web. */
function OrderRow({ order, now, today }: { order: Order; now: Date; today: boolean }) {
  const t = useContent('orders');
  const { money, clock } = useRegion();
  const visitWords = useVisitWords();
  const count = t.plural('shared.itemCount', itemCount(order.items));
  const payment = t(`payment.${paymentLabel(order)}`);
  // "Table 12" for dine-in (as drawn); "Takeaway" / "Delivery" otherwise, with a badge.
  const table = visitWords(order);
  const placed = formatPlaced(order.placedAt, now, clock);
  const names = order.items.map((i) => i.name).join(', ');
  return (
    <li>
      <Link href={orderHref(order)} className={cx(styles.row, !isFinished(order) && styles.active)}>
        <OrderThumb order={order} />
        <span className={styles.main}>
          <span className={styles.top}>
            <span className={styles.id}>{t('shared.orderRef', { id: order.id })}</span>
            {order.mode !== 'dineIn' && <ModeBadge mode={order.mode} className={styles.mode} />}
            <OrderStatus order={order} className="hide-desktop" />
          </span>
          <span className={cx(styles.sub, 'hide-desktop')}>
            {count} · {money.format(order.total)} · {payment}
          </span>
          <span className={cx(styles.sub, styles.when, 'hide-desktop')}>
            {placed} · {table}
          </span>
          <span className={cx(styles.sub, styles.clamp, 'hide-mobile')}>
            {count} · {today ? names : table}
          </span>
        </span>
        <span className={cx(styles.sub, 'hide-mobile')}>{placed}</span>
        <span className={cx(styles.amount, 'hide-mobile')}>
          <b>{money.format(order.total)}</b>
          <span className={styles.when}>{payment}</span>
        </span>
        <OrderStatus order={order} className={cx(styles.status, 'hide-mobile')} />
        <Icon name="chev" size="sm" className={cx(styles.chev, 'hide-mobile')} />
      </Link>
    </li>
  );
}

function VisitSection({
  id,
  title,
  summary,
  orders,
  now,
  today,
}: {
  id: string;
  title: ReactNode;
  summary?: string;
  orders: Order[];
  now: Date;
  today: boolean;
}) {
  const t = useContent('orders');
  return (
    <section className={cx(styles.panel, today && styles.thisVisit)} aria-labelledby={id}>
      <div className={styles.panelHead}>
        <h2 id={id} className={styles.panelTitle}>
          {title}
        </h2>
        {summary && <span className={cx('t-small c2 hide-mobile')}>{summary}</span>}
      </div>
      {today && (
        <div className={cx(styles.row, styles.thead, 'hide-mobile')} aria-hidden="true">
          <span />
          <span>{t('list.columns.order')}</span>
          <span>{t('list.columns.placed')}</span>
          <span>{t('list.columns.amount')}</span>
          <span>{t('shared.status')}</span>
          <span />
        </div>
      )}
      <ul className={styles.list}>
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} now={now} today={today} />
        ))}
      </ul>
    </section>
  );
}

/** "This visit · Today", plus "at Table 12" on the web when every order was dine-in at one table. */
function VisitTitle({ orders }: { orders: Order[] }) {
  const t = useContent('orders');
  const tables = new Set(orders.map((o) => (o.mode === 'dineIn' ? o.table : undefined)));
  const [table] = tables;
  return (
    <>
      {t('list.thisVisit')}
      {tables.size === 1 && table !== undefined && (
        <span className="hide-mobile">{t('list.atTable', { table })}</span>
      )}
    </>
  );
}

/** My orders (16 · w16): this visit and earlier visits. */
export function MyOrders() {
  const branch = useBranch();
  const { money, clock } = useRegion();
  const t = useContent('orders');
  const data = useLiveOrderList();

  let content;
  if (!data) {
    content = (
      <div className={styles.loading} aria-busy="true" aria-label={t('list.loading')}>
        <Skeleton shape="block" width="100%" height={104} />
        <Skeleton shape="block" width="100%" height={84} />
        <Skeleton shape="block" width="100%" height={84} />
      </div>
    );
  } else if (data.orders.length === 0) {
    content = (
      <EmptyState
        icon="list"
        tone="neutral"
        title={t('list.empty.title')}
        className={styles.empty}
        actions={<Button href="/menu/">{t('shared.browseMenu')}</Button>}
      >
        {t('list.empty.body')}
      </EmptyState>
    );
  } else {
    const { today, earlier } = groupByVisit(data.orders, data.now, clock);
    content = (
      <>
        {today.length > 0 && (
          <VisitSection
            id="this-visit"
            title={<VisitTitle orders={today} />}
            summary={`${t.plural('shared.orderCount', today.length)} · ${money.format(spentTotal(today))}`}
            orders={today}
            now={data.now}
            today
          />
        )}
        {earlier.length > 0 && (
          <VisitSection
            id="earlier-visits"
            title={t('list.earlier')}
            orders={earlier}
            now={data.now}
            today={false}
          />
        )}
      </>
    );
  }

  return (
    <Page>
      <SiteHeader />
      <MobileHeader variant="topbar">
        <h1 className={styles.mobileTitle}>{t('shared.myOrders')}</h1>
      </MobileHeader>
      <main id="main" className={styles.page}>
        <div className={cx(styles.pageHead, 'hide-mobile')}>
          <div className={styles.headText}>
            <h1 className="t-display">{t('shared.myOrders')}</h1>
            <p className="t-body c2">{t('list.lede', { restaurant: branch.name })}</p>
          </div>
          <Button href="/menu/" size="sm" iconStart="plus">
            {t('list.newOrder')}
          </Button>
        </div>
        {content}
      </main>
      <BottomNav />
    </Page>
  );
}
