'use client';

import { useEffect, useRef, useState } from 'react';
import { PaymentMethods, type PaymentMethodOption } from '@/components/checkout/PaymentMethods';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Columns, Page } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Breadcrumbs } from '@/components/menu/Breadcrumbs';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { Banner, Button, EmptyState, Icon, Skeleton } from '@/components/ui';
import { useOrderingAvailability } from '@/hooks/useRestaurantStatus';
import { cx } from '@/lib/cx';
import { billFor } from '@/lib/service';
import type { Order } from '@/types/order';
import { PAYMENT_METHODS, pickMethod } from '@/lib/payments';
import type { PaymentMethodId } from '@/types/branch';
import { BillOrderList } from './BillOrderList';
import { BillTotals } from './BillTotals';
import { PayBillFailed, PayBillPaid, PayBillProcessing } from './PayBillStatus';
import { usePayBill, type BillPayment, type PaidBill } from './usePayBill';
import styles from './PayBillView.module.css';
import { useDineInOnly } from '@/hooks/useDineInOnly';
import type { TableLabel } from '@/hooks/useTable';

type Phase =
  | { step: 'choose'; returning?: boolean }
  | { step: 'processing'; payment: BillPayment }
  | { step: 'failed'; payment: BillPayment }
  | { step: 'paid'; receipt: PaidBill };

/**
 * Pay my bill: one guest pays their own unpaid orders at a shared table (with one of the
 * branch's in-app methods, mock payment), then sees them marked paid. Reached from "Pay
 * {amount} now" on the bill pages when "Just my orders" has something to pay. Other guests'
 * orders are never paid here.
 */
export function PayBillView() {
  useDineInOnly();
  const t = useContent('service');
  const { table, sessionId, bill, hydrated, startPayment, completePayment, failPayment, settled } =
    usePayBill();
  const { state, retry } = useOrderingAvailability();
  const offline = state === 'offline';
  const options = useBranch().payments.bill;
  const [chosen, setMethod] = useState<PaymentMethodId | null>(null);
  const method = pickMethod(options, chosen);
  const [phase, setPhase] = useState<Phase>({ step: 'choose' });
  const opening = useRef(false);

  /** Opens a payment request and waits on it; a second tap meanwhile is ignored. */
  const pay = async (payWith: PaymentMethodId) => {
    if (opening.current) return;
    opening.current = true;
    const payment = await startPayment(payWith);
    opening.current = false;
    if (payment) setPhase({ step: 'processing', payment });
  };

  if (phase.step === 'paid') return <PayBillPaid receipt={phase.receipt} table={table} />;

  if (phase.step === 'processing') {
    const { payment } = phase;
    return (
      <PayBillProcessing
        payment={payment}
        table={table}
        disabled={offline || settled}
        onCancel={() => setPhase({ step: 'choose', returning: true })}
        onFailure={() => {
          failPayment(payment);
          setPhase({ step: 'failed', payment });
        }}
        onSuccess={async () => {
          const receipt = await completePayment(payment);
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
        onRetry={() => pay(phase.payment.method)}
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
          if (!offline) void pay(method);
        }}
      />
    </Page>
  );
}

interface PayFormProps {
  table: TableLabel;
  sessionId: string | undefined;
  payable: Order[];
  method: PaymentMethodId;
  onMethodChange: (method: PaymentMethodId) => void;
  offline: boolean;
  onRetryConnection: () => void;
  /** Coming back from a payment: focus the chosen method. */
  focusMethod: boolean;
  onPay: () => void;
}

/** The guest's unpaid orders, the amount, the branch's payment methods and Pay (laid out like 20 · w20). */
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
  const { paymentPartner, payments } = useBranch();
  const { money } = useRegion();
  const methodsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusMethod)
      methodsRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [focusMethod]);
  // The payable orders as a bill of their own: total = balance due = the amount to pay.
  const due = billFor(payable, 'mine', sessionId);
  const amount = money.format(due.payableTotal);

  // The branch's in-app methods (GET /branches › payments.bill), described in content.
  const methods: PaymentMethodOption<PaymentMethodId>[] = payments.bill.map((o) => ({
    id: o.id,
    title: t(`payBill.methods.${o.labelKey}.title`),
    mobileSub: t(`payBill.methods.${o.labelKey}.mobileSub`),
    desktopSub: t(`payBill.methods.${o.labelKey}.desktopSub`),
    icon: PAYMENT_METHODS[o.id].icon,
  }));
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
          <BillTotals bill={due} scope="mine" balanceOnly className="hide-desktop" />
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
        <BillTotals bill={due} scope="mine" balanceOnly />
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
