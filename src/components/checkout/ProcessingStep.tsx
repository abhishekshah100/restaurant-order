'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, EmptyState, Icon, Spinner, Tag } from '@/components/ui';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { restaurant } from '@/data/restaurant';
import { useCheckout } from '@/context/CheckoutContext';
import { useCart } from '@/hooks/useCart';
import { useCountdown } from '@/hooks/useCountdown';
import { usePlaceOrder } from '@/hooks/usePlaceOrder';
import { useQueryParam } from '@/hooks/useQueryParam';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import { formatCountdown, formatINR, pluralize } from '@/lib/format';
import styles from './Processing.module.css';

type View = 'processing' | 'failed' | 'cancelled';

/**
 * Online payment (12 · w12) with its failure (s08 · ws08) and cancel (s09 · ws09) outcomes.
 * Preview an outcome with ?state=payment-failed or ?state=payment-cancelled.
 * The cart is kept on failure and cancel.
 */
export function ProcessingStep() {
  const router = useRouter();
  const preview = useQueryParam('state');
  const { lines, bill, hydrated } = useCart();
  const { session, startPayment } = useCheckout();
  const table = useTable();
  const placeOrder = usePlaceOrder();
  const [outcome, setOutcome] = useState<View | null>(null);
  const remaining = useCountdown(session.paymentEndsAt);

  const previewView: View | null =
    preview === 'payment-failed' ? 'failed' : preview === 'payment-cancelled' ? 'cancelled' : null;
  // The UPI request expiring counts as a failure.
  const expired = remaining === 0 && session.paymentEndsAt !== null;
  const base: View = outcome ?? previewView ?? 'processing';
  const view: View = base === 'processing' && expired ? 'failed' : base;

  const summary = `${pluralize(lines.length, 'item')} · Table ${table}`;
  const total = formatINR(bill.total);

  const retry = () => {
    startPayment();
    setOutcome('processing');
    if (preview) router.replace('/checkout/processing/');
  };

  if (hydrated && lines.length === 0 && !previewView) {
    return (
      <div className={styles.page}>
        <SiteHeader variant="payment" />
        <MobileHeader variant="pill-end" />
        <main id="main" className={styles.body}>
          <div className={styles.cancelled}>
            <EmptyState
              icon="bag"
              title="Nothing to pay for"
              as="h1"
              actions={<Button href="/menu/">Browse the menu</Button>}
            >
              Your cart is empty, so there&apos;s no payment in progress.
            </EmptyState>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SiteHeader variant="payment" />
      <MobileHeader variant={view === 'processing' ? 'pill-center' : 'pill-end'} />
      <main id="main" className={cx(styles.body, view !== 'processing' && styles.grow)}>
        {view === 'processing' && (
          <section className={cx(styles.card, styles.processing)} aria-busy="true">
            <div className={styles.spinWrap}>
              <Spinner tone="brand" size="lg" />
            </div>
            <div className={styles.text}>
              <h1 className="t-h1">Confirming your payment</h1>
              <p className={cx('t-body c2', styles.lede)} role="status">
                <span className="hide-desktop">
                  Approve the request in your UPI app. Please don&apos;t close this page or press
                  back.
                </span>
                <span className="hide-mobile">
                  Approve the request in your UPI app or bank page. Please don&apos;t close or
                  refresh this tab.
                </span>
              </p>
            </div>
            <div className={styles.amountCard}>
              <div className={styles.amountRow}>
                <span className="t-small c2">Amount</span>
                <span className={styles.amount}>{total}</span>
                <span className="t-small c3 hide-mobile">{summary}</span>
              </div>
              <hr className={styles.hr} />
              <ol className={styles.steps} aria-label="Payment progress">
                <li className={cx(styles.step, styles.stepOk)}>
                  <Icon name="checkc" size="sm" />
                  Payment request sent
                </li>
                <li className={cx(styles.step, styles.stepCur)} aria-current="step">
                  <Spinner tone="brand" />
                  <span>
                    <span className="hide-desktop">Waiting for your approval</span>
                    <span className="hide-mobile">Waiting for approval</span>
                  </span>
                  <span className={cx('t-small c3', styles.timeLeft)}>
                    {remaining === null ? '4:32' : formatCountdown(remaining)}
                    <span className="hide-desktop"> left</span>
                  </span>
                </li>
                <li className={cx(styles.step, styles.stepTodo)}>
                  <span className={styles.circle} aria-hidden="true" />
                  <span>
                    <span className="hide-desktop">Sending order to the kitchen</span>
                    <span className="hide-mobile">Sending to the kitchen</span>
                  </span>
                </li>
              </ol>
            </div>
            <div className={cx(styles.foot, styles.desktopOnly)}>
              <ProcessingFoot
                onCancel={() => setOutcome('cancelled')}
                onSuccess={() => placeOrder('online')}
                onFailure={() => setOutcome('failed')}
              />
            </div>
          </section>
        )}

        {view === 'failed' && (
          <section className={cx(styles.card, styles.compact)} role="alert">
            <EmptyHeader icon="alert" tone="err" title="Payment didn't go through">
              The UPI request expired before it was approved.{' '}
              <b className={styles.ink}>No money was taken.</b>
            </EmptyHeader>
            <div className={styles.savedCard}>
              <div className={styles.savedHead}>
                <div className={styles.savedText}>
                  <span className="t-h3">Your order is saved</span>
                  <span className="t-small c2 hide-mobile">
                    {summary} · {total}
                  </span>
                </div>
                <Tag variant="warn">Not sent yet</Tag>
              </div>
              <span className="t-small c2 hide-desktop">
                {summary} · {total}
              </span>
              <hr className={styles.hr} />
              <p className={cx(styles.hint, 'hide-desktop')}>
                <Icon name="info" size="xs" />
                If any amount was debited, it&apos;s refunded automatically within 5–7 working days.
              </p>
            </div>
            <p className={cx(styles.hint, styles.hintOutside, 'hide-mobile')}>
              <Icon name="info" size="xs" />
              If any amount was debited, it&apos;s refunded automatically within 5–7 working days.
            </p>
            <div className={cx(styles.actions, 'hide-mobile')}>
              <Button iconStart="refresh" onClick={retry}>
                Retry {total}
              </Button>
              <Button variant="secondary" href="/checkout/payment/">
                Change payment method
              </Button>
            </div>
            <Button variant="ghost" href="/cart/" className="hide-mobile">
              Back to order
            </Button>
          </section>
        )}

        {view === 'cancelled' && (
          <section className={styles.cancelled} role="status">
            <EmptyHeader icon="xc" tone="neutral" title="Payment cancelled">
              You cancelled the payment, so nothing was charged. Your cart is just as you left it.
            </EmptyHeader>
            <div className={styles.well}>
              <span className="t-small c2">{summary}</span>
              <span className={styles.price}>{total}</span>
            </div>
            <div className={cx(styles.actions, 'hide-mobile')}>
              <Button onClick={retry}>Try paying again</Button>
              <Button variant="secondary" iconStart="cash" onClick={() => placeOrder('counter')}>
                Pay at the counter
              </Button>
            </div>
            <Button variant="ghost" href="/cart/" className="hide-mobile">
              Back to cart
            </Button>
          </section>
        )}
      </main>

      {view === 'processing' && (
        <div className={cx(styles.foot, 'hide-desktop')}>
          <ProcessingFoot
            onCancel={() => setOutcome('cancelled')}
            onSuccess={() => placeOrder('online')}
            onFailure={() => setOutcome('failed')}
          />
        </div>
      )}
      {view === 'failed' && (
        <div className={cx(styles.foot, styles.footStack, 'hide-desktop')}>
          <Button block iconStart="refresh" onClick={retry}>
            Retry {total}
          </Button>
          <Button block variant="secondary" href="/checkout/payment/">
            Change payment method
          </Button>
          <Button block variant="ghost" href="/cart/">
            Back to order
          </Button>
        </div>
      )}
      {view === 'cancelled' && (
        <div className={cx(styles.foot, styles.footStack, 'hide-desktop')}>
          <Button block onClick={retry}>
            Try paying again
          </Button>
          <Button block variant="secondary" iconStart="cash" onClick={() => placeOrder('counter')}>
            Pay at the counter instead
          </Button>
          <Button block variant="ghost" href="/cart/">
            Back to cart
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyHeader({
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

function ProcessingFoot({
  onCancel,
  onSuccess,
  onFailure,
}: {
  onCancel: () => void;
  onSuccess: () => void;
  onFailure: () => void;
}) {
  return (
    <>
      <p className={cx('t-small c3', styles.secure)}>
        <Icon name="shield" size="xs" />
        Encrypted payment · Secured by {restaurant.paymentPartner}
      </p>
      <Button variant="ghost" onClick={onCancel}>
        Cancel payment
      </Button>
      <div className={styles.proto}>
        <button type="button" className={styles.protoLink} onClick={onSuccess}>
          Prototype: success
        </button>
        <button type="button" className={styles.protoLink} onClick={onFailure}>
          Prototype: failure
        </button>
      </div>
    </>
  );
}
