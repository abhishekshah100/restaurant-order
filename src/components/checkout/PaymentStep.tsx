'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { PriceSummary } from '@/components/cart/PriceSummary';
import { Button, Icon } from '@/components/ui';
import { useContent, useRestaurant } from '@/api/hooks';
import { useCheckout } from '@/context/CheckoutContext';
import { useCart } from '@/hooks/useCart';
import { useCheckoutGuard } from '@/hooks/useCheckoutGuard';
import { usePlaceOrderState } from '@/hooks/usePlaceOrder';
import { useTable } from '@/hooks/useTable';
import { cx } from '@/lib/cx';
import { formatINR } from '@/lib/format';
import type { PaymentMethod } from '@/types/order';
import { CheckoutFrame } from './CheckoutFrame';
import { OrderSummaryPanel } from './OrderSummaryPanel';
import { PaymentMethods, type PaymentMethodOption } from './PaymentMethods';
import styles from './Checkout.module.css';

/** Step 3 — pay online or at the counter (11 · w11). */
export function PaymentStep() {
  const ready = useCheckoutGuard('pay');
  const { session } = useCheckout();
  const table = useTable();
  const t = useContent('checkout');
  return (
    <CheckoutFrame
      step="pay"
      backHref="/checkout/verify/"
      backLabel={t('frame.back')}
      ready={ready}
      aside={
        <OrderSummaryPanel
          variant="combined"
          totalLabel={t('payment.amountPayable')}
          editable={false}
          footnote={t('lines.nameTable', { name: session.name, table })}
        />
      }
    >
      {ready && <PaymentForm />}
    </CheckoutFrame>
  );
}

function PaymentForm() {
  const restaurant = useRestaurant();
  const router = useRouter();
  const table = useTable();
  const { bill } = useCart();
  const { session, setMethod, startPayment } = useCheckout();
  const { placeOrder, placing } = usePlaceOrderState();
  const t = useContent('checkout');
  const cartText = useContent('cart');
  const method = session.method;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (placing) return;
    if (method === 'online') {
      startPayment();
      router.push('/checkout/processing/');
    } else {
      placeOrder('counter');
    }
  };

  const methods: PaymentMethodOption<PaymentMethod>[] = [
    {
      id: 'online',
      title: t('payment.methods.online.title'),
      mobileSub: t('payment.methods.online.mobileSub'),
      desktopSub: t('payment.methods.online.desktopSub'),
      icon: 'mobile',
      tag: t('payment.fastest'),
    },
    {
      id: 'counter',
      title: t('payment.methods.counter.title'),
      mobileSub: t('payment.methods.counter.mobileSub'),
      desktopSub: t('payment.methods.counter.mobileSub'),
      icon: 'cash',
    },
  ];

  const total = formatINR(bill.total);
  const payLabel =
    method === 'online' ? t('payment.payOnline', { total }) : t('payment.placeOrder', { total });
  const payIcon = method === 'online' ? 'lock' : undefined;
  const secured = t('payment.secured', { partner: restaurant.paymentPartner });

  return (
    <form className={styles.stack} onSubmit={onSubmit} noValidate>
      <div className={styles.intro}>
        <Link href="/checkout/verify/" className={cx(styles.backLink, 'hide-mobile')}>
          <Icon name="back" size="xs" />
          {t('frame.back')}
        </Link>
        <h1 className={styles.title}>{t('payment.title')}</h1>
        <p className="t-body c2 hide-mobile">{t('payment.intro')}</p>
      </div>

      <section className={cx(styles.payCard, 'hide-desktop')} aria-label={t('summary.title')}>
        <div className={styles.payCardHead}>
          <span className="t-small c2">
            {t('lines.restaurantTable', { restaurant: restaurant.name, table })}
          </span>
          <span className="t-small c2">{cartText.plural('itemCount', bill.itemCount)}</span>
        </div>
        <PriceSummary
          bill={bill}
          variant="combined"
          totalLabel={t('payment.amountPayable')}
          tight
        />
      </section>

      <PaymentMethods
        label={t('payment.methodsLabel')}
        methods={methods}
        value={method}
        onChange={setMethod}
      />

      <p className={cx(styles.payNote, 'hide-desktop')}>
        <Icon name="checkc" size="xs" />
        {t('payment.intro')}
      </p>

      <div className={cx(styles.desktopFoot, 'hide-mobile')}>
        <p className={cx('t-small c3', styles.fine)}>
          <Icon name="shield" size="xs" />
          {secured}
        </p>
        <Button type="submit" iconStart={payIcon} loading={placing}>
          {payLabel}
        </Button>
      </div>

      <div className={cx(styles.formFoot, 'hide-desktop')}>
        <Button type="submit" block iconStart={payIcon} loading={placing}>
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
