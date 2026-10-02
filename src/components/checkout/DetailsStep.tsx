'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Icon, Input, PhoneInput } from '@/components/ui';
import { useCheckout } from '@/context/CheckoutContext';
import { useCart } from '@/hooks/useCart';
import { useCheckoutGuard } from '@/hooks/useCheckoutGuard';
import { useTable } from '@/hooks/useTable';
import { hasErrors, validateDetails } from '@/lib/checkout';
import { cx } from '@/lib/cx';
import { formatINR, pluralize } from '@/lib/format';
import { CheckoutFrame } from './CheckoutFrame';
import { OrderSummaryPanel } from './OrderSummaryPanel';
import styles from './Checkout.module.css';

/** Step 1 — name and mobile number (09 · w09). */
export function DetailsStep() {
  const ready = useCheckoutGuard('details');
  const { session } = useCheckout();
  const table = useTable();
  return (
    <CheckoutFrame
      step="details"
      backHref="/cart/"
      backLabel="Back to cart"
      ready={ready}
      aside={<OrderSummaryPanel footnote={`The Olive Table · Table ${table}`} />}
    >
      {ready && (
        <DetailsForm key={session.phone} initialName={session.name} initialPhone={session.phone} />
      )}
    </CheckoutFrame>
  );
}

function DetailsForm({ initialName, initialPhone }: { initialName: string; initialPhone: string }) {
  const router = useRouter();
  const table = useTable();
  const { lines, bill } = useCart();
  const { submitDetails } = useCheckout();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [submitted, setSubmitted] = useState(false);

  const errors = validateDetails(name, phone);
  const show = (field: 'name' | 'phone') =>
    submitted || touched[field] ? errors[field] : undefined;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) {
      document.getElementById(errors.name ? 'checkout-name' : 'checkout-phone')?.focus();
      return;
    }
    submitDetails(name, phone);
    router.push('/checkout/verify/');
  };

  const sendLabel = 'Send OTP';

  return (
    <form className={styles.stack} onSubmit={onSubmit} noValidate>
      <div className={styles.intro}>
        <Link href="/cart/" className={cx(styles.backLink, 'hide-mobile')}>
          <Icon name="back" size="xs" />
          Back to cart
        </Link>
        <h1 className={styles.title}>Who&apos;s ordering?</h1>
        <p className="t-body c2">
          So the team knows whose order is whose at Table {table}.
          <span className="hide-mobile"> No account needed.</span>
        </p>
      </div>

      <div className={styles.form}>
        <Input
          id="checkout-name"
          label="Full name"
          autoComplete="name"
          placeholder="Enter your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          error={show('name')}
          required
        />
        <PhoneInput
          id="checkout-phone"
          value={phone}
          onChange={setPhone}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          error={show('phone')}
          hint={
            <>
              <Icon name="info" size="xs" />
              For order updates and verification. We&apos;ll send a 6-digit code by SMS.
            </>
          }
        />
      </div>

      <div className={cx(styles.well, 'hide-desktop')}>
        <span className="t-small c2">
          {pluralize(lines.length, 'item')} · Table {table}
        </span>
        <span className={styles.price}>{formatINR(bill.total)}</span>
      </div>

      <div className={cx(styles.desktopFoot, 'hide-mobile')}>
        <p className={cx('t-small c3', styles.fine)}>
          <Icon name="lock" size="xs" />
          Your number is used only for this order.
        </p>
        <Button type="submit" iconEnd="arrow">
          {sendLabel}
        </Button>
      </div>

      <div className={cx(styles.formFoot, 'hide-desktop')}>
        <Button type="submit" block iconEnd="arrow">
          {sendLabel}
        </Button>
        <p className={cx('t-small c3', styles.fine)}>
          <Icon name="lock" size="xs" />
          Your number is used only for this order.
        </p>
      </div>
    </form>
  );
}
