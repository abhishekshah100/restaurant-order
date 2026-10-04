'use client';

import { useState } from 'react';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Columns, Page } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Breadcrumbs } from '@/components/menu/Breadcrumbs';
import { useContent, useRegion } from '@/api/hooks';
import { Banner, Button, EmptyState, Icon, OptionGroup, Skeleton } from '@/components/ui';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { cx } from '@/lib/cx';
import { PAY_BILL_PATH, SERVICE_PATHS, billFor, firstName } from '@/lib/service';
import type { BillScope } from '@/types/service';
import { BillOrderList } from './BillOrderList';
import { BillTotals } from './BillTotals';
import { useRegionCopy } from '@/hooks/useRegionCopy';
import { useTableVisit } from './useTableVisit';
import styles from './BillRequestView.module.css';
import { useDineInOnly } from '@/hooks/useDineInOnly';

/** Request the bill (20 · w20). */
export function BillRequestView() {
  useDineInOnly();
  const t = useContent('service');
  const { money, clock } = useRegion();
  const { table, sessionId, orders, hydrated } = useTableVisit();
  const { requests, sendBillRequest } = useServiceRequest();
  const { paymentMethods } = useRegionCopy();
  const [picked, setPicked] = useState<BillScope>('table');

  const mine = billFor(orders, 'mine', sessionId);
  const whole = billFor(orders, 'table', sessionId);
  const scope: BillScope = mine.orders.length === 0 ? 'table' : picked;
  const bill = scope === 'mine' ? mine : whole;
  const pending = requests.bill;

  const header = (
    <>
      <SiteHeader />
      <MobileHeader
        variant="topbar"
        title={t('shared.requestBill')}
        backHref="/help/"
        backLabel={t('billRequest.backToService')}
      />
    </>
  );

  if (!hydrated) {
    return (
      <Page>
        {header}
        <main
          id="main"
          className={styles.loading}
          aria-busy="true"
          aria-label={t('billRequest.loading')}
        >
          <Skeleton shape="block" width="100%" height={140} />
          <Skeleton shape="block" width="100%" height={260} />
        </main>
      </Page>
    );
  }

  if (orders.length === 0) {
    return (
      <Page>
        {header}
        <main id="main" className={styles.empty}>
          <EmptyState
            icon="receipt"
            tone="neutral"
            as="h1"
            title={t('billRequest.emptyTitle')}
            actions={<Button href="/menu/">{t('shared.browseMenu')}</Button>}
          >
            {t('billRequest.emptyBody', { table })}
          </EmptyState>
        </main>
      </Page>
    );
  }

  // Only "Just my orders" can be paid in the app; the whole table's bill comes from the server.
  const canPay = scope === 'mine' && bill.payableTotal > 0;
  const requestVariant = canPay ? 'secondary' : 'primary';
  const confirm = (
    <div className={styles.actions}>
      {canPay && (
        <Button href={PAY_BILL_PATH} block iconStart="lock">
          {t('shared.payNow', { amount: money.format(bill.payableTotal) })}
        </Button>
      )}
      {pending ? (
        <Button href={SERVICE_PATHS.bill} variant={requestVariant} block iconStart="receipt">
          {t('billRequest.viewRequest')}
        </Button>
      ) : (
        <Button
          variant={requestVariant}
          block
          iconStart="receipt"
          onClick={() => sendBillRequest(scope)}
        >
          {t('billRequest.confirm')}
        </Button>
      )}
    </div>
  );
  const mineIds = mine.orders.map((o) => `#${o.id}`).join(', ');
  const mineName = firstName(mine.orders[0]?.customerName ?? '');
  const heading = t('billRequest.heading', {
    table,
    orders: t.plural('shared.orderCount', bill.orders.length),
  });
  const crumbs = [
    { label: t('billRequest.service'), href: '/help/' },
    { label: t('shared.requestBill') },
  ];

  return (
    <Page>
      {header}
      <Columns className={styles.cols}>
        <main id="main" className={styles.main}>
          <Breadcrumbs items={crumbs} />
          <h1 className={cx('t-display', 'hide-mobile')}>{t('shared.requestTheBill')}</h1>

          {pending && (
            <Banner
              tone="info"
              icon="clock"
              live="polite"
              action={
                <Button href={SERVICE_PATHS.bill} variant="ghost" size="sm">
                  {t('billRequest.view')}
                </Button>
              }
            >
              {t('billRequest.pending', { time: clock.time(pending.requestedAt) })}
            </Banner>
          )}

          <div className={styles.scope}>
            <OptionGroup
              id="bill-scope"
              type="radio"
              title={t('billRequest.scopeTitle')}
              titleClassName="visually-hidden"
              layout="grid"
              value={scope}
              onChange={(id) => setPicked(id as BillScope)}
              choices={[
                {
                  id: 'mine',
                  label: t('billRequest.mine'),
                  sub: mine.orders.length
                    ? `${mineIds}${mineName ? ` · ${mineName}` : ''}`
                    : t('billRequest.mineNone'),
                  price: money.format(mine.total),
                  disabled: mine.orders.length === 0,
                },
                {
                  id: 'table',
                  label: t('billRequest.table'),
                  sub: t('billRequest.tableSub', {
                    orders: t.plural('shared.orderCount', whole.orders.length),
                    table,
                  }),
                  price: money.format(whole.total),
                },
              ]}
            />
          </div>

          <section className={styles.card} aria-labelledby="bill-orders">
            <h2 id="bill-orders" className={cx('t-h3', styles.cardTitle)}>
              {heading}
            </h2>
            <BillOrderList orders={bill.orders} sessionId={sessionId} />
            <BillTotals bill={bill} scope={scope} signed className="hide-desktop" />
          </section>
          <p className={cx(styles.hint, 'hide-desktop')}>
            <Icon name="info" size="xs" className={styles.hintIcon} />
            {t('billRequest.hint', { paymentMethods })}
          </p>
          <div className={cx(styles.foot, 'hide-desktop')}>{confirm}</div>
        </main>

        <aside className={cx(styles.aside, 'hide-mobile')} aria-labelledby="bill-summary">
          <h2 id="bill-summary" className="t-h2">
            {t('shared.billSummary')}
          </h2>
          <BillTotals bill={bill} scope={scope} signed />
          {confirm}
          <p className={styles.hint}>
            <Icon name="info" size="xs" className={styles.hintIcon} />
            {t('billRequest.hint', { paymentMethods })}
          </p>
        </aside>
      </Columns>
    </Page>
  );
}
