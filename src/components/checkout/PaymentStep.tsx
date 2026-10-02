'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, type FormEvent, type KeyboardEvent } from 'react';
import { PriceSummary } from '@/components/cart/PriceSummary';
import { Button, Icon, Tag } from '@/components/ui';
import { restaurant } from '@/data/restaurant';
import { useCheckout } from '@/context/CheckoutContext';
import { useCart } from '@/hooks/useCart';
import { useCheckoutGuard } from '@/hooks/useCheckoutGuard';
import { usePlaceOrder } from '@/hooks/usePlaceOrder';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import { formatINR, pluralize } from '@/lib/format';
import type { PaymentMethod } from '@/types/order';
import { CheckoutFrame } from './CheckoutFrame';
import { OrderSummaryPanel } from './OrderSummaryPanel';
import styles from './Checkout.module.css';

const METHODS: {
  id: PaymentMethod;
  title: string;
  mobileSub: string;
  desktopSub: string;
  icon: 'mobile' | 'cash';
  fastest?: boolean;
}[] = [
  {
    id: 'online',
    title: 'Pay online now',
    mobileSub: 'UPI, debit / credit card or netbanking. Kitchen starts right away.',
    desktopSub: 'UPI, debit / credit card or netbanking',
    icon: 'mobile',
    fastest: true,
  },
  {
    id: 'counter',
    title: 'Pay at the counter',
    mobileSub: 'Cash, card or UPI when you leave. Your order is still sent now.',
    desktopSub: 'Cash, card or UPI when you leave',
    icon: 'cash',
  },
];

/** Step 3 — pay online or at the counter (11 · w11). */
export function PaymentStep() {
  const ready = useCheckoutGuard('pay');
  const { session } = useCheckout();
  const table = useTable();
  return (
    <CheckoutFrame
      step="pay"
      backHref="/checkout/verify/"
      backLabel="Back"
      ready={ready}
      aside={
        <OrderSummaryPanel
          variant="combined"
          totalLabel="Amount payable"
          editable={false}
          footnote={`${session.name} · Table ${table}`}
        />
      }
    >
      {ready && <PaymentForm />}
    </CheckoutFrame>
  );
}

function PaymentForm() {
  const router = useRouter();
  const table = useTable();
  const { lines, bill } = useCart();
  const { session, setMethod, startPayment } = useCheckout();
  const placeOrder = usePlaceOrder();
  const groupRef = useRef<HTMLDivElement>(null);
  const method = session.method;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (method === 'online') {
      startPayment();
      router.push('/checkout/processing/');
    } else {
      placeOrder('counter');
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = method === 'online' ? 'counter' : 'online';
    setMethod(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-method="${next}"]`)?.focus();
  };

  const payLabel =
    method === 'online' ? `Pay ${formatINR(bill.total)}` : `Place order · ${formatINR(bill.total)}`;
  const secured = `Secured by ${restaurant.paymentPartner} · Card details are never stored`;

  return (
    <form className={styles.stack} onSubmit={onSubmit} noValidate>
      <div className={styles.intro}>
        <Link href="/checkout/verify/" className={cx(styles.backLink, 'hide-mobile')}>
          <Icon name="back" size="xs" />
          Back
        </Link>
        <h1 className={styles.title}>How would you like to pay?</h1>
        <p className="t-body c2 hide-mobile">
          Either way, your order goes to the kitchen as soon as you confirm.
        </p>
      </div>

      <section className={cx(styles.payCard, 'hide-desktop')} aria-label="Order summary">
        <div className={styles.payCardHead}>
          <span className="t-small c2">
            {restaurant.name} · Table {table}
          </span>
          <span className="t-small c2">{pluralize(lines.length, 'item')}</span>
        </div>
        <PriceSummary bill={bill} variant="compact" totalLabel="Amount payable" tight />
      </section>

      <div ref={groupRef} className={styles.methods} role="radiogroup" aria-label="Payment method">
        {METHODS.map((m) => {
          const on = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              data-method={m.id}
              className={cx(styles.method, on && styles.methodOn)}
              onClick={() => setMethod(m.id)}
              onKeyDown={onKeyDown}
            >
              <span className={styles.methodTopRow}>
                <span className={styles.radio} aria-hidden="true" />
                {m.fastest && (
                  <span className={styles.desktopTag}>
                    <Tag variant="ok" icon={null}>
                      Fastest
                    </Tag>
                  </span>
                )}
              </span>
              <span className={styles.methodBody}>
                <span className={styles.methodTitle}>
                  <span className={styles.methodTitleText}>{m.title}</span>
                  {m.fastest && (
                    <span className={styles.mobileTag}>
                      <Tag variant="ok" icon={null}>
                        Fastest
                      </Tag>
                    </span>
                  )}
                </span>
                <span className={styles.methodSub}>
                  <span className="hide-desktop">{m.mobileSub}</span>
                  <span className="hide-mobile">{m.desktopSub}</span>
                </span>
              </span>
              <Icon name={m.icon} className={styles.methodIcon} />
            </button>
          );
        })}
      </div>

      <div className={cx(styles.desktopFoot, 'hide-mobile')}>
        <p className={cx('t-small c3', styles.fine)}>
          <Icon name="shield" size="xs" />
          {secured}
        </p>
        <Button type="submit" iconStart={method === 'online' ? 'lock' : undefined}>
          {payLabel}
        </Button>
      </div>

      <div className={cx(styles.formFoot, 'hide-desktop')}>
        <Button type="submit" block iconStart={method === 'online' ? 'lock' : undefined}>
          {payLabel}
        </Button>
        <p className={cx('t-small c3', styles.fine)}>
          <Icon name="shield" size="xs" />
          {secured}
        </p>
      </div>
    </form>
  );
}
