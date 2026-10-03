'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useContent, useRestaurant } from '@/api/hooks';
import { Button, Icon, Input, PhoneInput } from '@/components/ui';
import { useCheckout } from '@/context/CheckoutContext';
import { useCart } from '@/hooks/useCart';
import { useCheckoutGuard } from '@/hooks/useCheckoutGuard';
import { useTable } from '@/hooks/useTable';
import { hasErrors, validateDetails } from '@/lib/checkout';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import { CheckoutFrame } from './CheckoutFrame';
import { OrderSummaryPanel } from './OrderSummaryPanel';
import styles from './Checkout.module.css';

/** Step 1 — name and mobile number (09 · w09). */
export function DetailsStep() {
  const ready = useCheckoutGuard('details');
  const { session } = useCheckout();
  const table = useTable();
  const restaurant = useRestaurant();
  const t = useContent('checkout');
  return (
    <CheckoutFrame
      step="details"
      backHref="/cart/"
      backLabel={t('frame.backToCart')}
      ready={ready}
      aside={
        <OrderSummaryPanel
          footnote={t('lines.restaurantTable', { restaurant: restaurant.name, table })}
        />
      }
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
  const { bill } = useCart();
  const { submitDetails } = useCheckout();
  const t = useContent('checkout');
  const cartText = useContent('cart');
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [submitted, setSubmitted] = useState(false);

  const errors = validateDetails(name, phone);
  const show = (field: 'name' | 'phone') => {
    const error = errors[field];
    return (submitted || touched[field]) && error ? t(`details.errors.${error}`) : undefined;
  };

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

  const sendLabel = t('details.submit');

  return (
    <form className={styles.stack} onSubmit={onSubmit} noValidate>
      <div className={styles.intro}>
        <Link href="/cart/" className={cx(styles.backLink, 'hide-mobile')}>
          <Icon name="back" size="xs" />
          {t('frame.backToCart')}
        </Link>
        <h1 className={styles.title}>{t('details.title')}</h1>
      </div>

      <div className={styles.form}>
        <Input
          id="checkout-name"
          icon="user"
          label={t('details.nameLabel')}
          autoComplete="name"
          placeholder={t('details.errors.nameTooShort')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          error={show('name')}
          required
        />
        <PhoneInput
          id="checkout-phone"
          showCountryCode={false}
          withIcon
          value={phone}
          onChange={setPhone}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          error={show('phone')}
          hint={
            <>
              <Icon name="info" size="xs" />
              {t('details.phoneHint')}
            </>
          }
        />
      </div>

      <Link href="/cart/" className={cx(styles.orderRow, 'hide-desktop')}>
        <span className={styles.orderRowIcon} aria-hidden="true">
          <Icon name="bag" size="sm" />
        </span>
        <span className={styles.orderRowText}>
          <span className={styles.orderRowTitle}>
            {t('lines.itemsTable', { items: cartText.plural('itemCount', bill.itemCount), table })}
          </span>
          <span className={styles.orderRowSub}>{t('details.orderRowSub')}</span>
        </span>
        <span className={styles.price}>{formatINR(bill.total)}</span>
      </Link>

      <ul className={cx(styles.trust, 'hide-mobile')} aria-label={t('details.trustLabel')}>
        <li>
          <Icon name="lock" size="xs" />
          {t('details.trust.secure')}
        </li>
        <li>
          <Icon name="user" size="xs" />
          {t('details.trust.noAccount')}
        </li>
        <li>
          <Icon name="shield" size="xs" />
          {t('details.trust.numberUse')}
        </li>
      </ul>

      <div className={cx(styles.desktopFoot, styles.desktopFootFull, 'hide-mobile')}>
        <Button type="submit" block iconEnd="arrow">
          {sendLabel}
        </Button>
      </div>

      <div className={cx(styles.formFoot, 'hide-desktop')}>
        <Button type="submit" block iconEnd="arrow">
          {sendLabel}
        </Button>
      </div>
    </form>
  );
}
