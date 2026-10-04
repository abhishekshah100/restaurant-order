'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { PriceSummary } from '@/components/cart/PriceSummary';
import { Button, Icon } from '@/components/ui';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { useCheckout } from '@/context/CheckoutContext';
import { useCheckoutGuard } from '@/hooks/useCheckoutGuard';
import { useOrderBill } from '@/hooks/useFulfilment';
import { usePayCheckout } from '@/hooks/usePayCheckout';
import { useVisitLabel } from '@/hooks/useVisitLabel';
import { cx } from '@/lib/cx';
import { modePayments } from '@/lib/fulfilment';
import { PAYMENT_METHODS, isOnlineMethod, pickMethod } from '@/lib/payments';
import type { PaymentMethodId } from '@/types/branch';
import { CheckoutFrame } from './CheckoutFrame';
import { OrderSummaryPanel } from './OrderSummaryPanel';
import { PaymentMethods, type PaymentMethodOption } from './PaymentMethods';
import styles from './Checkout.module.css';

/** Step 3 — pay online or at the counter (11 · w11). */
export function PaymentStep() {
  const ready = useCheckoutGuard('pay');
  const { session } = useCheckout();
  const visit = useVisitLabel();
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
          footnote={t('lines.nameVisit', { name: session.name, visit })}
        />
      }
    >
      {ready && <PaymentForm />}
    </CheckoutFrame>
  );
}

function PaymentForm() {
  const branch = useBranch();
  const { money } = useRegion();
  const router = useRouter();
  const visit = useVisitLabel();
  const { bill, mode } = useOrderBill();
  const { session, setMethod } = useCheckout();
  const { start, placeOrder, placing } = usePayCheckout();
  const t = useContent('checkout');
  const cartText = useContent('cart');
  // The methods for how the guest orders (GET /branches › payments.checkout or modes.<mode>.payments).
  const options = modePayments(branch, mode);
  const method = pickMethod(options, session.method);
  const online = isOnlineMethod(method);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (placing) return;
    if (!online) placeOrder(method);
    else if (await start(method)) router.push('/checkout/processing/');
  };

  // Described in content (checkout › payment.methods).
  const methods: PaymentMethodOption<PaymentMethodId>[] = options.map((o) => ({
    id: o.id,
    title: t(`payment.methods.${o.labelKey}.title`),
    mobileSub: t(`payment.methods.${o.labelKey}.mobileSub`),
    desktopSub: t(`payment.methods.${o.labelKey}.desktopSub`),
    icon: PAYMENT_METHODS[o.id].icon,
    tag: o.recommended ? t('payment.fastest') : undefined,
  }));

  const total = money.format(bill.total);
  const payLabel = online ? t('payment.payOnline', { total }) : t('payment.placeOrder', { total });
  const payIcon = online ? 'lock' : undefined;
  const secured = t('payment.secured', { partner: branch.paymentPartner });

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
            {t('lines.restaurantVisit', { restaurant: branch.name, visit })}
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
