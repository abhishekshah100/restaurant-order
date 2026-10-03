'use client';

import { MobileHeader } from '@/components/layout/MobileHeader';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { useContent, useRestaurant } from '@/api/hooks';
import { Button, EmptyState, Icon, Spinner } from '@/components/ui';
import { useFocusOnMount } from '@/hooks/useFocusOnMount';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import type { BillPayment, PaidBill } from './usePayBill';
import { RequestStatus } from './RequestStatus';
import styles from './PayBillView.module.css';

interface ProcessingProps {
  payment: BillPayment;
  table: number;
  /** True while the result can't be accepted (offline, or already recorded). */
  disabled: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  onFailure: () => void;
}

/** Waiting for the guest to approve the payment (as 12 · w12, without the order steps). */
export function PayBillProcessing({ payment, table, ...foot }: ProcessingProps) {
  const t = useContent('service');
  const titleRef = useFocusOnMount<HTMLHeadingElement>();
  const summary = t('payBill.processing.summary', {
    orders: t.plural('shared.orderCount', payment.orderIds.length),
    table,
  });
  return (
    <div className={styles.statusPage}>
      <SiteHeader variant="payment" />
      <MobileHeader variant="pill-center" />
      <main id="main" className={styles.statusBody}>
        <section className={styles.processing} aria-busy="true" aria-labelledby="pay-status">
          <div className={styles.spinWrap}>
            <Spinner tone="brand" size="lg" />
          </div>
          <div className={styles.statusText}>
            <h1 id="pay-status" className="t-h1" ref={titleRef} tabIndex={-1}>
              {t('payBill.processing.title')}
            </h1>
            <p className={cx('t-body c2', styles.statusLede)} role="status">
              {t(`payBill.processing.lede.${payment.method}`)}
            </p>
          </div>
          <div className={styles.amountCard}>
            <div className={styles.amountRow}>
              <span className="t-small c2">{t('payBill.processing.amount')}</span>
              <span className={styles.amount}>{formatINR(payment.amount)}</span>
              <span className="t-small c3 hide-mobile">{summary}</span>
            </div>
            <hr className={styles.hr} />
            <ol className={styles.steps} aria-label={t('payBill.processing.progressLabel')}>
              <li className={cx(styles.step, styles.stepOk)}>
                <Icon name="checkc" size="sm" />
                {t('payBill.processing.requestSent')}
              </li>
              <li className={cx(styles.step, styles.stepCur)} aria-current="step">
                <Spinner tone="brand" />
                {t('payBill.processing.waiting')}
              </li>
              <li className={cx(styles.step, styles.stepTodo)}>
                <span className={styles.circle} aria-hidden="true" />
                {t('payBill.processing.settling')}
              </li>
            </ol>
          </div>
          <div className={cx(styles.statusFoot, 'hide-mobile')}>
            <ProcessingFoot {...foot} />
          </div>
        </section>
      </main>
      <div className={cx(styles.statusFoot, 'hide-desktop')}>
        <ProcessingFoot {...foot} />
      </div>
    </div>
  );
}

function ProcessingFoot({
  disabled,
  onCancel,
  onSuccess,
  onFailure,
}: Omit<ProcessingProps, 'payment' | 'table'>) {
  const t = useContent('service');
  const { paymentPartner } = useRestaurant();
  return (
    <>
      <p className={cx('t-small c3', styles.secure)}>
        <Icon name="shield" size="xs" />
        {t('payBill.processing.secure', { partner: paymentPartner })}
      </p>
      <Button variant="ghost" onClick={onCancel}>
        {t('payBill.processing.cancel')}
      </Button>
      <div className={styles.proto}>
        <button type="button" className={styles.protoLink} onClick={onSuccess} disabled={disabled}>
          {t('payBill.processing.protoSuccess')}
        </button>
        <button type="button" className={styles.protoLink} onClick={onFailure} disabled={disabled}>
          {t('payBill.processing.protoFailure')}
        </button>
      </div>
    </>
  );
}

interface FailedProps {
  payment: BillPayment;
  table: number;
  onRetry: () => void;
  onChangeMethod: () => void;
}

/** The payment failed (as s08 · ws08): nothing was paid, the orders stay unpaid. */
export function PayBillFailed({ payment, table, onRetry, onChangeMethod }: FailedProps) {
  const t = useContent('service');
  const titleRef = useFocusOnMount<HTMLSpanElement>();
  const amount = formatINR(payment.amount);
  const summary = t('payBill.processing.summary', {
    orders: t.plural('shared.orderCount', payment.orderIds.length),
    table,
  });
  const actions = (block: boolean) => (
    <>
      <Button block={block} iconStart="refresh" onClick={onRetry}>
        {t('payBill.failed.retry', { amount })}
      </Button>
      <Button block={block} variant="secondary" onClick={onChangeMethod}>
        {t('payBill.failed.changeMethod')}
      </Button>
      <Button block={block} variant="ghost" href="/help/bill/">
        {t('payBill.backToBill')}
      </Button>
    </>
  );
  return (
    <div className={styles.statusPage}>
      <SiteHeader variant="payment" />
      <MobileHeader variant="pill-end" />
      <main id="main" className={cx(styles.statusBody, styles.grow)}>
        <section className={styles.failed} role="alert">
          <EmptyState
            icon="alert"
            tone="err"
            as="h1"
            title={
              // EmptyState renders the heading; focus lands on its text.
              <span ref={titleRef} tabIndex={-1} className={styles.focusTitle}>
                {t('payBill.failed.title')}
              </span>
            }
            className={styles.emptyHeader}
          >
            {t('payBill.failed.body')}
          </EmptyState>
          <div className={styles.well}>
            <span className="t-small c2">{summary}</span>
            <span className={styles.price}>{amount}</span>
          </div>
          <div className={cx(styles.inlineActions, 'hide-mobile')}>{actions(false)}</div>
        </section>
      </main>
      <div className={cx(styles.statusFoot, styles.footStack, 'hide-desktop')}>{actions(true)}</div>
    </div>
  );
}

interface PaidProps {
  receipt: PaidBill;
  table: number;
}

/** Bill paid: the amount, how it was paid and the orders it covered. */
export function PayBillPaid({ receipt, table }: PaidProps) {
  const t = useContent('service');
  const titleRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <RequestStatus
      icon="checkc"
      tone="ok"
      title={t('payBill.paid.title')}
      lede={t('payBill.paid.lede', { table })}
      titleRef={titleRef}
      summary={
        <dl className={styles.receipt} aria-label={t('payBill.paid.summaryLabel')}>
          <div className={styles.receiptRow}>
            <dt>{t('payBill.paid.amount')}</dt>
            <dd className={styles.receiptAmount}>{formatINR(receipt.amount)}</dd>
          </div>
          <div className={styles.receiptRow}>
            <dt>{t('payBill.paid.method')}</dt>
            <dd>{t(`payBill.methodNames.${receipt.method}`)}</dd>
          </div>
          <div className={styles.receiptRow}>
            <dt>{t('payBill.paid.orders')}</dt>
            <dd>
              {receipt.orders
                .map((o) => t('billOrders.orderRef', { id: o.id }))
                .join(', ')}
            </dd>
          </div>
        </dl>
      }
      actions={(layout) => (
        <>
          <Button href="/menu/" block={layout === 'mobile'}>
            {t('shared.backToMenu')}
          </Button>
          <Button
            href="/orders/"
            variant={layout === 'mobile' ? 'ghost' : 'secondary'}
            block={layout === 'mobile'}
          >
            {t('payBill.paid.viewOrders')}
          </Button>
        </>
      )}
    />
  );
}
