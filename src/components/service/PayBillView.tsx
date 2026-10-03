'use client';

import { useEffect, useRef, useState } from 'react';
import { PaymentMethods, type PaymentMethodOption } from '@/components/checkout/PaymentMethods';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Columns, Page } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Breadcrumbs } from '@/components/menu/Breadcrumbs';
import { useContent, useRestaurant } from '@/api/hooks';
import { Banner, Button, EmptyState, Icon, Skeleton } from '@/components/ui';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import { billFor } from '@/lib/service';
import type { Order } from '@/types/order';
import type { BillPaymentMethod } from '@/types/service';
import { BillOrderList } from './BillOrderList';
import { BillTotals } from './BillTotals';
import { PayBillFailed, PayBillPaid, PayBillProcessing } from './PayBillStatus';
import { usePayBill, type BillPayment, type PaidBill } from './usePayBill';
import styles from './PayBillView.module.css';

type Phase =
  | { step: 'choose'; returning?: boolean }
  | { step: 'processing' | 'failed'; payment: BillPayment }
  | { step: 'paid'; receipt: PaidBill };

/**
 * Pay my bill: one guest pays their own unpaid orders at a shared table (UPI or card, mock
 * payment), then sees them marked paid. Reached from "Pay ₹X now" on the bill pages when
 * "Just my orders" has something to pay. Other guests' orders are never paid here.
 */
export function PayBillView() {
  const t = useContent('service');
  const { table, sessionId, bill, hydrated, startPayment, completePayment, settled } =
    usePayBill();
  const { state, retry } = useOrderingAvailability();
  const offline = state === 'offline';
  const [method, setMethod] = useState<BillPaymentMethod>('upi');
  const [phase, setPhase] = useState<Phase>({ step: 'choose' });

  if (phase.step === 'paid') return <PayBillPaid receipt={phase.receipt} table={table} />;

  if (phase.step === 'processing') {
    const { payment } = phase;
    return (
      <PayBillProcessing
        payment={payment}
        table={table}
        disabled={offline || settled}
        onCancel={() => setPhase({ step: 'choose', returning: true })}
        onFailure={() => setPhase({ step: 'failed', payment })}
        onSuccess={() => {
          const receipt = completePayment(payment);
          // Nothing was left to pay (settled in another tab): the form shows the empty state.
          setPhase(receipt ? { step: 'paid', receipt } : { step: 'choose' });
        }}
      />
    );
  }

  if (phase.step === 'failed') {
    return (
      <PayBillFailed
        payment={phase.payment}
        table={table}
        onRetry={() => setPhase({ step: 'processing', payment: phase.payment })}
        onChangeMethod={() => setPhase({ step: 'choose', returning: true })}
      />
    );
  }

  const header = (
    <>
      <SiteHeader />
      <MobileHeader
        variant="topbar"
        title={t('payBill.title')}
        backHref="/help/bill/"
        backLabel={t('payBill.backToBill')}
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
          aria-label={t('payBill.loading')}
        >
          <Skeleton shape="block" width="100%" height={180} />
          <Skeleton shape="block" width="100%" height={160} />
        </main>
      </Page>
    );
  }

  if (bill.payable.length === 0) {
    return (
      <Page>
        {header}
        <main id="main" className={styles.empty}>
          <EmptyState
            icon="receipt"
            tone="neutral"
            as="h1"
            title={t('payBill.emptyTitle')}
            actions={
              <>
                <Button href="/help/bill/">{t('payBill.viewBill')}</Button>
                <Button href="/menu/" variant="ghost">
                  {t('shared.backToMenu')}
                </Button>
              </>
            }
          >
            {t('payBill.emptyBody', { table })}
          </EmptyState>
        </main>
      </Page>
    );
  }

  return (
    <Page>
      {header}
      <PayForm
        table={table}
        sessionId={sessionId}
        payable={bill.payable}
        method={method}
        onMethodChange={setMethod}
        offline={offline}
        onRetryConnection={retry}
        focusMethod={phase.returning === true}
        onPay={() => {
          if (offline) return;
          setPhase({ step: 'processing', payment: startPayment(method) });
        }}
      />
    </Page>
  );
}

interface PayFormProps {
  table: number;
  sessionId: string | undefined;
  payable: Order[];
  method: BillPaymentMethod;
  onMethodChange: (method: BillPaymentMethod) => void;
  offline: boolean;
  onRetryConnection: () => void;
  /** Coming back from a payment: focus the chosen method. */
  focusMethod: boolean;
  onPay: () => void;
}

/** The guest's unpaid orders, the amount, UPI or card, and Pay (laid out like 20 · w20). */
function PayForm({
  table,
  sessionId,
  payable,
  method,
  onMethodChange,
  offline,
  onRetryConnection,
  focusMethod,
  onPay,
}: PayFormProps) {
  const t = useContent('service');
  const { paymentPartner } = useRestaurant();
  const methodsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusMethod) methodsRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [focusMethod]);
  // The payable orders as a bill of their own: total = balance due = the amount to pay.
  const due = billFor(payable, 'mine', sessionId);
  const amount = formatINR(due.payableTotal);

  const methods: PaymentMethodOption<BillPaymentMethod>[] = [
    {
      id: 'upi',
      title: t('payBill.methods.upi.title'),
      mobileSub: t('payBill.methods.upi.mobileSub'),
      desktopSub: t('payBill.methods.upi.desktopSub'),
      icon: 'mobile',
    },
    {
      id: 'card',
      title: t('payBill.methods.card.title'),
      mobileSub: t('payBill.methods.card.mobileSub'),
      desktopSub: t('payBill.methods.card.desktopSub'),
      icon: 'card',
    },
  ];
  const crumbs = [
    { label: t('billRequest.service'), href: '/help/' },
    { label: t('shared.requestBill'), href: '/help/bill/' },
    { label: t('payBill.title') },
  ];
  const payButton = (
    <Button block iconStart="lock" onClick={onPay} disabled={offline}>
      {t('payBill.pay', { amount })}
    </Button>
  );
  const secured = (
    <p className={cx('t-small c3', styles.fine)}>
      <Icon name="shield" size="xs" />
      {t('payBill.secured', { partner: paymentPartner })}
    </p>
  );

  return (
    <Columns className={styles.cols}>
      <main id="main" className={styles.main}>
        <Breadcrumbs items={crumbs} />
        <div className={styles.intro}>
          <h1 className={cx('t-display', 'hide-mobile')}>{t('payBill.heading')}</h1>
          <p className="t-body c2">{t('payBill.intro', { table })}</p>
        </div>

        {offline && (
          <Banner
            tone="err"
            live="assertive"
            action={
              <Button variant="ghost" size="sm" onClick={onRetryConnection}>
                {t('payBill.tryAgain')}
              </Button>
            }
          >
            {t('payBill.offline')}
          </Banner>
        )}

        <section className={styles.card} aria-labelledby="pay-orders">
          <h2 id="pay-orders" className={cx('t-h3', styles.cardTitle)}>
            {t('payBill.ordersHeading', {
              orders: t.plural('shared.orderCount', payable.length),
            })}
          </h2>
          <BillOrderList orders={payable} sessionId={sessionId} />
          <BillTotals bill={due} scope="mine" className={cx(styles.cardTotals, 'hide-desktop')} />
        </section>

        <div ref={methodsRef} className={styles.methods}>
          <h2 className={cx('t-h3', styles.methodsTitle)}>{t('payBill.methodsLabel')}</h2>
          <PaymentMethods
            label={t('payBill.methodsLabel')}
            methods={methods}
            value={method}
            onChange={onMethodChange}
          />
        </div>

        <div className={cx(styles.foot, 'hide-desktop')}>
          {payButton}
          {secured}
        </div>
      </main>

      <aside className={cx(styles.aside, 'hide-mobile')} aria-labelledby="pay-summary">
        <h2 id="pay-summary" className="t-h2">
          {t('shared.billSummary')}
        </h2>
        <BillTotals bill={due} scope="mine" />
        {payButton}
        {secured}
        <p className={styles.hint}>
          <Icon name="info" size="xs" className={styles.hintIcon} />
          {t('payBill.hint')}
        </p>
      </aside>
    </Columns>
  );
}
