'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, EmptyState, Icon, Spinner, Tag, type IconName } from '@/components/ui';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { useCheckout } from '@/context/CheckoutContext';
import { useCheckoutGuard } from '@/hooks/useCheckoutGuard';
import { useCountdown } from '@/hooks/useCountdown';
import { usePayCheckout } from '@/hooks/usePayCheckout';
import { useQueryParam } from '@/hooks/useQueryParam';
import { useOrderBill } from '@/hooks/useFulfilment';
import { useVisitLabel } from '@/hooks/useVisitLabel';
import { cx } from '@/lib/cx';
import { modePayments } from '@/lib/fulfilment';
import { isOnlineMethod, onlineMethod, type Approval } from '@/lib/payments';
import { formatCountdown } from '@/lib/format';
import styles from './Processing.module.css';

type View = 'processing' | 'failed' | 'cancelled';

/**
 * Online payment (12 · w12) with its failure (s08 · ws08) and cancel (s09 · ws09) outcomes.
 * Preview an outcome with ?state=payment-failed or ?state=payment-cancelled.
 * The cart is kept on failure and cancel. Guarded like the payment step: an empty
 * cart goes to /cart and an unverified number back to the OTP step, in every state.
 */
export function ProcessingStep() {
  const ready = useCheckoutGuard('pay');
  const router = useRouter();
  const preview = useQueryParam('state');
  const { bill, mode } = useOrderBill();
  const { session } = useCheckout();
  const visit = useVisitLabel();
  const { start, succeed, fail, placeOrder, placing } = usePayCheckout();
  const [outcome, setOutcome] = useState<View | null>(null);
  const { payment } = session;
  const remaining = useCountdown(payment?.expiresAt ?? null);
  // The request's window as the server opened it (4:32), shown until the countdown starts.
  const windowSeconds = payment ? Math.round((payment.expiresAt - payment.createdAt) / 1000) : 0;
  const t = useContent('checkout');
  const cartText = useContent('cart');
  const branch = useBranch();
  const { money } = useRegion();
  const options = modePayments(branch, mode);
  const approval = onlineMethod(options, session.method);
  // Paying in person instead: at the counter, at pickup or cash on delivery, where offered.
  const inPerson = options.find((o) => !isOnlineMethod(o.id));

  const previewView: View | null =
    preview === 'payment-failed' ? 'failed' : preview === 'payment-cancelled' ? 'cancelled' : null;
  // The payment request expiring counts as a failure.
  const expired = remaining === 0 && payment !== null;
  const base: View = outcome ?? previewView ?? 'processing';
  const view: View = base === 'processing' && expired ? 'failed' : base;
  // Nothing to wait for without a payment request: choose how to pay first.
  const noRequest = ready && view === 'processing' && payment === null;
  useEffect(() => {
    if (noRequest) router.replace('/checkout/payment/');
  }, [noRequest, router]);

  const summary = t('lines.itemsVisit', {
    items: cartText.plural('itemCount', bill.itemCount),
    visit,
  });
  const total = money.format(bill.total);

  const retry = async () => {
    if (!(await start(approval.method))) return;
    setOutcome('processing');
    if (preview) router.replace('/checkout/processing/');
  };

  if (!ready || noRequest) {
    return (
      <div className={styles.page}>
        <SiteHeader variant="payment" />
        <MobileHeader variant="pill-end" />
        <main
          id="main"
          className={styles.body}
          aria-busy="true"
          aria-label={t('processing.loading')}
        />
      </div>
    );
  }

  const foot: ProcessingFootProps = {
    disabled: placing,
    onCancel: () => setOutcome('cancelled'),
    onSuccess: succeed,
    onFailure: () => {
      fail();
      setOutcome('failed');
    },
  };
  const retryAction: ActionSpec = {
    label: t('failed.retry', { total }),
    iconStart: 'refresh',
    onClick: retry,
  };
  const changeMethod: ActionSpec = { label: t('failed.changeMethod'), href: '/checkout/payment/' };
  const tryAgain: ActionSpec = {
    label: t('cancelled.tryAgain'),
    onClick: retry,
    disabled: placing,
  };

  return (
    <div className={styles.page}>
      <SiteHeader variant="payment" />
      <MobileHeader variant={view === 'processing' ? 'pill-center' : 'pill-end'} />
      <main id="main" className={cx(styles.body, view !== 'processing' && styles.grow)}>
        {view === 'processing' && (
          <ProcessingView
            total={total}
            summary={summary}
            approval={approval}
            remaining={remaining ?? windowSeconds}
            foot={foot}
          />
        )}
        {view === 'failed' && (
          <FailedView total={total} summary={summary} approval={approval}>
            <OutcomeActions
              placement="inline"
              primary={{ ...retryAction, disabled: placing }}
              secondary={changeMethod}
              backLabel={t('failed.backToOrder')}
            />
          </FailedView>
        )}
        {view === 'cancelled' && (
          <CancelledView total={total} summary={summary}>
            <OutcomeActions
              placement="inline"
              primary={tryAgain}
              secondary={
                inPerson && {
                  label: t(`payment.methods.${inPerson.labelKey}.title`),
                  iconStart: 'cash',
                  onClick: () => placeOrder(inPerson.id),
                  loading: placing,
                }
              }
              backLabel={t('frame.backToCart')}
            />
          </CancelledView>
        )}
      </main>

      {view === 'processing' && (
        <div className={cx(styles.foot, 'hide-desktop')}>
          <ProcessingFoot {...foot} />
        </div>
      )}
      {view === 'failed' && (
        <OutcomeActions
          placement="foot"
          primary={{ ...retryAction, disabled: placing }}
          secondary={changeMethod}
          backLabel={t('failed.backToOrder')}
        />
      )}
      {view === 'cancelled' && (
        <OutcomeActions
          placement="foot"
          primary={tryAgain}
          secondary={
            inPerson && {
              label:
                mode === 'dineIn'
                  ? t('cancelled.payAtCounterInstead')
                  : t(`payment.methods.${inPerson.labelKey}.title`),
              iconStart: 'cash',
              onClick: () => placeOrder(inPerson.id),
              loading: placing,
            }
          }
          backLabel={t('frame.backToCart')}
        />
      )}
    </div>
  );
}

/** The processing copy names the method: "Approve the request in your eSewa app". */
function useApprovalVars({ method }: Approval) {
  return { name: useContent('common')(`paymentMethods.${method}`) };
}

function ProcessingView({
  total,
  summary,
  approval,
  remaining,
  foot,
}: {
  total: string;
  summary: string;
  approval: Approval;
  /** Seconds left to approve the request. */
  remaining: number;
  foot: ProcessingFootProps;
}) {
  const t = useContent('checkout');
  const vars = useApprovalVars(approval);
  return (
    <section className={cx(styles.card, styles.processing)} aria-busy="true">
      <div className={styles.spinWrap}>
        <Spinner tone="brand" size="lg" />
      </div>
      <div className={styles.text}>
        <h1 className="t-h1">{t('processing.title')}</h1>
        <p className={cx('t-body c2', styles.lede)} role="status">
          <span className="hide-desktop">{t(`processing.lede.${approval.kind}.mobile`, vars)}</span>
          <span className="hide-mobile">{t(`processing.lede.${approval.kind}.desktop`, vars)}</span>
        </p>
      </div>
      <div className={styles.amountCard}>
        <div className={styles.amountRow}>
          <span className="t-small c2">{t('processing.amount')}</span>
          <span className={styles.amount}>{total}</span>
          <span className="t-small c3 hide-mobile">{summary}</span>
        </div>
        <hr className={styles.hr} />
        <ol className={styles.steps} aria-label={t('processing.progressLabel')}>
          <li className={cx(styles.step, styles.stepOk)}>
            <Icon name="checkc" size="sm" />
            {t('processing.requestSent')}
          </li>
          <li className={cx(styles.step, styles.stepCur)} aria-current="step">
            <Spinner tone="brand" />
            <span>
              <span className="hide-desktop">{t('processing.waitingMobile')}</span>
              <span className="hide-mobile">{t('processing.waitingDesktop')}</span>
            </span>
            <span className={cx('t-small c3', styles.timeLeft)}>
              {formatCountdown(remaining)}
              <span className="hide-desktop">{t('processing.timeLeft')}</span>
            </span>
          </li>
          <li className={cx(styles.step, styles.stepTodo)}>
            <span className={styles.circle} aria-hidden="true" />
            <span>
              <span className="hide-desktop">{t('processing.sendingMobile')}</span>
              <span className="hide-mobile">{t('processing.sendingDesktop')}</span>
            </span>
          </li>
        </ol>
      </div>
      <div className={cx(styles.foot, styles.desktopOnly)}>
        <ProcessingFoot {...foot} />
      </div>
    </section>
  );
}

function FailedView({
  total,
  summary,
  approval,
  children,
}: {
  total: string;
  summary: string;
  approval: Approval;
  children: ReactNode;
}) {
  const t = useContent('checkout');
  const vars = useApprovalVars(approval);
  const summaryTotal = t('failed.summaryTotal', { summary, total });
  return (
    <section className={cx(styles.card, styles.compact)} role="alert">
      <OutcomeHeader icon="alert" tone="err" title={t('failed.title')}>
        {t.rich(
          `failed.body.${approval.kind}`,
          { b: (chunks) => <b className={styles.ink}>{chunks}</b> },
          vars,
        )}
      </OutcomeHeader>
      <div className={styles.savedCard}>
        <div className={styles.savedHead}>
          <div className={styles.savedText}>
            <span className="t-h3">{t('failed.saved')}</span>
            <span className="t-small c2 hide-mobile">{summaryTotal}</span>
          </div>
          <Tag variant="warn">{t('failed.notSent')}</Tag>
        </div>
        <span className="t-small c2 hide-desktop">{summaryTotal}</span>
        <hr className={styles.hr} />
        <p className={cx(styles.hint, 'hide-desktop')}>
          <Icon name="info" size="xs" />
          {t('failed.refundHint')}
        </p>
      </div>
      <p className={cx(styles.hint, styles.hintOutside, 'hide-mobile')}>
        <Icon name="info" size="xs" />
        {t('failed.refundHint')}
      </p>
      {children}
    </section>
  );
}

function CancelledView({
  total,
  summary,
  children,
}: {
  total: string;
  summary: string;
  children: ReactNode;
}) {
  const t = useContent('checkout');
  return (
    <section className={styles.cancelled} role="status">
      <OutcomeHeader icon="xc" tone="neutral" title={t('cancelled.title')}>
        {t('cancelled.body')}
      </OutcomeHeader>
      <div className={styles.well}>
        <span className="t-small c2">{summary}</span>
        <span className={styles.price}>{total}</span>
      </div>
      {children}
    </section>
  );
}

function OutcomeHeader({
  icon,
  tone,
  title,
  children,
}: {
  icon: 'alert' | 'xc';
  tone: 'err' | 'neutral';
  title: string;
  children: ReactNode;
}) {
  return (
    <EmptyState icon={icon} tone={tone} title={title} as="h1" className={styles.emptyHeader}>
      {children}
    </EmptyState>
  );
}

interface ActionSpec {
  label: string;
  iconStart?: IconName;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

function ActionButton({
  spec,
  variant,
  block,
}: {
  spec: ActionSpec;
  variant?: 'secondary';
  block?: boolean;
}) {
  if (spec.href !== undefined) {
    return (
      <Button variant={variant} block={block} iconStart={spec.iconStart} href={spec.href}>
        {spec.label}
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      block={block}
      iconStart={spec.iconStart}
      onClick={spec.onClick}
      disabled={spec.disabled}
      loading={spec.loading}
    >
      {spec.label}
    </Button>
  );
}

/**
 * Failed / cancelled actions: inline in the card on desktop, a stacked bottom footer on mobile.
 * The back link always returns to the cart.
 */
function OutcomeActions({
  placement,
  primary,
  secondary,
  backLabel,
}: {
  placement: 'inline' | 'foot';
  primary: ActionSpec;
  /** Absent when there's no other way to pay (e.g. no in-person option for this mode). */
  secondary: ActionSpec | undefined;
  backLabel: string;
}) {
  if (placement === 'inline') {
    return (
      <>
        <div className={cx(styles.actions, 'hide-mobile')}>
          <ActionButton spec={primary} />
          {secondary && <ActionButton spec={secondary} variant="secondary" />}
        </div>
        <Button variant="ghost" href="/cart/" className="hide-mobile">
          {backLabel}
        </Button>
      </>
    );
  }
  return (
    <div className={cx(styles.foot, styles.footStack, 'hide-desktop')}>
      <ActionButton spec={primary} block />
      {secondary && <ActionButton spec={secondary} variant="secondary" block />}
      <Button block variant="ghost" href="/cart/">
        {backLabel}
      </Button>
    </div>
  );
}

interface ProcessingFootProps {
  /** True while the order is being placed. */
  disabled: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  onFailure: () => void;
}

function ProcessingFoot({ disabled, onCancel, onSuccess, onFailure }: ProcessingFootProps) {
  const { paymentPartner } = useBranch();
  const t = useContent('checkout');
  return (
    <>
      <p className={cx('t-small c3', styles.secure)}>
        <Icon name="shield" size="xs" />
        {t('processing.secure', { partner: paymentPartner })}
      </p>
      <Button variant="ghost" onClick={onCancel} disabled={disabled}>
        {t('processing.cancel')}
      </Button>
      <div className={styles.proto}>
        <button type="button" className={styles.protoLink} onClick={onSuccess} disabled={disabled}>
          {t('processing.protoSuccess')}
        </button>
        <button type="button" className={styles.protoLink} onClick={onFailure} disabled={disabled}>
          {t('processing.protoFailure')}
        </button>
      </div>
    </>
  );
}
