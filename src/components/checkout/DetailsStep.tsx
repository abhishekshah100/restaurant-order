'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { Button, Icon, Input, PhoneInput } from '@/components/ui';
import { useCheckout } from '@/context/CheckoutContext';
import { useVisit, useVisitActions } from '@/context/GuestSessionContext';
import { useCheckoutGuard } from '@/hooks/useCheckoutGuard';
import { useOrderBill } from '@/hooks/useFulfilment';
import { useRequestFailed } from '@/hooks/useRequestFailed';
import { useSavedAddresses } from '@/hooks/useSavedAddresses';
import { useVisitLabel } from '@/hooks/useVisitLabel';
import { cleanAddress, validateAddress } from '@/lib/addresses';
import { hasErrors, validateDetails, type NameError } from '@/lib/checkout';
import { cx } from '@/lib/cx';
import { deliveryAreas, pickupOptions } from '@/lib/fulfilment';
import type { PhoneError } from '@/lib/phone';
import type { DeliveryAddress } from '@/types/order';
import { AddressForm } from './AddressForm';
import { CheckoutFrame } from './CheckoutFrame';
import { OrderSummaryPanel } from './OrderSummaryPanel';
import { PickupTimePicker } from './PickupTimePicker';
import styles from './Checkout.module.css';

/** Step 1 — name and mobile number (09 · w09); the pickup time or delivery address when ordering that way. */
export function DetailsStep() {
  const ready = useCheckoutGuard('details');
  const { session } = useCheckout();
  const visit = useVisitLabel();
  const branch = useBranch();
  const t = useContent('checkout');
  return (
    <CheckoutFrame
      step="details"
      backHref="/cart/"
      backLabel={t('frame.backToCart')}
      ready={ready}
      aside={
        <OrderSummaryPanel
          footnote={t('lines.restaurantVisit', { restaurant: branch.name, visit })}
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
  const visitLabel = useVisitLabel();
  const { mode, deliveryArea } = useVisit();
  const { update } = useVisitActions();
  const { bill } = useOrderBill();
  const { session, submitDetails, setFulfilment } = useCheckout();
  const t = useContent('checkout');
  const cartText = useContent('cart');
  const branch = useBranch();
  const { money, mobile } = useRegion();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [submitted, setSubmitted] = useState(false);
  const sending = useRef(false);
  const requestFailed = useRequestFailed();

  // Takeaway: when to collect. Delivery: where to (a saved address, or a new one).
  const [pickupAt, setPickupAt] = useState(session.pickupAt);
  const { addresses: saved, remember } = useSavedAddresses();
  const [draft, setDraft] = useState<DeliveryAddress>(
    () => session.address ?? { line: '', area: deliveryArea ?? '', label: 'home' },
  );
  const [pickedSaved, setPickedSaved] = useState<number | null | undefined>(undefined);
  // A saved address is offered first, unless the guest entered one in this checkout.
  const savedIndex = pickedSaved === undefined ? (saved.length > 0 && !session.address ? 0 : null) : pickedSaved;
  const address = savedIndex !== null ? (saved[savedIndex] ?? draft) : draft;
  const areas = deliveryAreas(branch.modes.delivery.zones);
  const addressErrors =
    mode === 'delivery' && savedIndex === null ? validateAddress(draft, areas) : {};

  const errors = validateDetails(name, phone, mobile);
  const message = (error: NameError | PhoneError) => {
    if (error === 'phoneLength') return t('details.errors.phoneLength', { length: mobile.length });
    // The prefix rule differs by country (content is keyed by the branch's country).
    if (error === 'phonePrefix') return t(`details.errors.phonePrefix.${branch.country}`);
    return t(`details.errors.${error}`);
  };
  const show = (field: 'name' | 'phone') => {
    const error = errors[field];
    return (submitted || touched[field]) && error ? message(error) : undefined;
  };

  /** Saves the pickup time or address; false if the delivery area couldn't be changed. */
  const saveFulfilment = async (): Promise<boolean> => {
    if (mode === 'takeaway') {
      // "As soon as possible" while it's offered, else the first slot.
      const { asap, slots } = pickupOptions(branch, new Date());
      const at = pickupAt ?? (asap ? null : (slots[0]?.toISOString() ?? null));
      setFulfilment({ pickupAt: at, address: null });
    } else if (mode === 'delivery') {
      const clean = cleanAddress(address);
      if (clean.area !== deliveryArea && !(await update({ deliveryArea: clean.area }))) {
        return false;
      }
      remember(clean);
      setFulfilment({ pickupAt: null, address: clean });
    }
    return true;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) {
      document.getElementById(errors.name ? 'checkout-name' : 'checkout-phone')?.focus();
      return;
    }
    if (addressErrors.line || addressErrors.area) {
      document.getElementById(addressErrors.line ? 'address-line' : 'address-area')?.focus();
      return;
    }
    // One code at a time: taps while it's being sent are ignored.
    if (sending.current) return;
    sending.current = true;
    const sent = (await saveFulfilment()) && (await submitDetails(name, phone));
    sending.current = false;
    if (sent) router.push('/checkout/verify/');
    else requestFailed();
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
          rules={mobile}
          showCountryCode={mobile.showDialCode}
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

      {mode === 'takeaway' && <PickupTimePicker value={pickupAt} onChange={setPickupAt} />}
      {mode === 'delivery' && (
        <AddressForm
          value={draft}
          onChange={setDraft}
          saved={saved}
          savedIndex={savedIndex}
          onPickSaved={setPickedSaved}
          errors={submitted ? addressErrors : {}}
        />
      )}

      <Link href="/cart/" className={cx(styles.orderRow, 'hide-desktop')}>
        <span className={styles.orderRowIcon} aria-hidden="true">
          <Icon name="bag" size="sm" />
        </span>
        <span className={styles.orderRowText}>
          <span className={styles.orderRowTitle}>
            {t('lines.itemsVisit', {
              items: cartText.plural('itemCount', bill.itemCount),
              visit: visitLabel,
            })}
          </span>
          <span className={styles.orderRowSub}>{t('details.orderRowSub')}</span>
        </span>
        <span className={styles.price}>{money.format(bill.total)}</span>
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
