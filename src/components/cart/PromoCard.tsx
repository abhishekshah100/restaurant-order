'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useContent, usePromotions, useRegion } from '@/api/hooks';
import { useValidatePromo } from '@/api/mutations';
import { Button, Icon, Input } from '@/components/ui';
import { useGuestSession } from '@/context/GuestSessionContext';
import { useCart, useCartActions } from '@/hooks/useCart';
import type { CartAction } from '@/hooks/useCartAction';
import { promoError, useOrderBill, type PromoError } from '@/hooks/useFulfilment';
import { useMinute } from '@/hooks/useOffers';
import { useRequestFailed } from '@/hooks/useRequestFailed';
import { orderLine } from '@/lib/cartLine';
import { cx } from '@/lib/cx';
import { availablePromos, normaliseCode } from '@/lib/promotions';
import type { OrderMode } from '@/types/branch';
import type { PromoCode } from '@/types/promotion';
import styles from './PromoCard.module.css';

/** Content key (cart › promo.errors) of each reason a code takes nothing off. */
const ERROR_KEYS = {
  promo_invalid: 'invalid',
  promo_expired: 'expired',
  promo_mode_not_eligible: 'modeNotEligible',
  promo_limit_reached: 'limitReached',
  below_minimum: 'belowMinimum',
} as const satisfies Record<PromoError['error'], string>;

const FIELD_ID = 'promo-code';

/** "10% off orders above ₹299, up to ₹100", from the code's rules. */
function useDescribePromo(): (promo: PromoCode) => string {
  const t = useContent('cart');
  const { money } = useRegion();
  return (promo) =>
    t(`promo.codes.${promo.descriptionKey}`, {
      discount: promo.type === 'percent' ? `${promo.value}%` : money.format(promo.value),
      minOrder: money.format(promo.minOrder),
      maxDiscount: money.format(promo.maxDiscount ?? 0),
    });
}

/** Why a code takes nothing off, in words: "Add ₹51 more to use WELCOME10." */
function useDescribeError(): (code: string, error: PromoError, mode: OrderMode) => string {
  const t = useContent('cart');
  const { money } = useRegion();
  return (code, { error, shortBy }, mode) =>
    t(`promo.errors.${ERROR_KEYS[error]}`, {
      code,
      amount: money.format(shortBy ?? 0),
      mode: t(`promo.modes.${mode}`),
    });
}

/**
 * Promo codes in the cart: "Apply promo code" opens a field and the outlet's codes for how the
 * guest orders (POST /promos/validate checks one); once applied, the code and what it saves,
 * with Remove. A round on a running order (or a change) uses the order's own code, so the card
 * just says so.
 */
export function PromoCard({ action }: { action: CartAction }) {
  if (action.kind === 'checkout') return <PromoForm />;
  const order = action.kind === 'addRound' ? action.tab : action.order;
  return order?.promoCode ? <TabPromo code={order.promoCode} orderId={order.id} /> : null;
}

/** The running order's code, which covers this round too. */
function TabPromo({ code, orderId }: { code: string; orderId: string }) {
  const t = useContent('cart');
  return (
    <p className={cx(styles.card, styles.note)}>
      <Icon name="tag" size="sm" />
      {t('promo.onTab', { code, id: orderId })}
    </p>
  );
}

function PromoForm() {
  const t = useContent('cart');
  const sessionId = useGuestSession()?.id;
  const { lines } = useCart();
  const { setPromoCode } = useCartActions();
  const { mode, promo } = useOrderBill();
  const { codes } = usePromotions();
  const minute = useMinute();
  const { money } = useRegion();
  const describe = useDescribePromo();
  const describeError = useDescribeError();
  const requestFailed = useRequestFailed();
  const validate = useValidatePromo();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Where focus goes once the card has changed under it: the applied code, or the field.
  const appliedRef = useRef<HTMLDivElement>(null);
  const focusNext = useRef<'applied' | 'field' | null>(null);
  const available = useMemo(
    () => (minute === null ? [] : availablePromos(codes, mode, new Date(minute))),
    [codes, mode, minute],
  );

  useEffect(() => {
    const target =
      focusNext.current === 'applied'
        ? appliedRef.current
        : focusNext.current === 'field'
          ? document.getElementById(FIELD_ID)
          : null;
    if (!target) return;
    target.focus();
    focusNext.current = null;
  });

  const apply = (typed: string) => {
    const code = normaliseCode(typed);
    if (!code) {
      setError(t('promo.errors.required'));
      return;
    }
    if (!sessionId || validate.isPending) return;
    validate.mutate(
      { sessionId, code, lines: lines.map(orderLine) },
      {
        onSuccess: (quote) => {
          setPromoCode(quote.code);
          setDraft('');
          setError(null);
          focusNext.current = 'applied';
        },
        onError: (failure) => {
          const reason = promoError(failure);
          if (reason) setError(describeError(code, reason, mode));
          else requestFailed();
        },
      },
    );
  };

  const remove = () => {
    setPromoCode(undefined);
    setOpen(true);
    focusNext.current = 'field';
  };

  if (promo) {
    const saving = promo.quote && promo.quote.discount > 0;
    return (
      <section className={cx(styles.card, styles.applied)} aria-labelledby="promo-applied">
        <span className={styles.icon}>
          <Icon name="tag" size="xs" />
        </span>
        <div className={styles.text} ref={appliedRef} tabIndex={-1} role="status">
          <h2 id="promo-applied" className={styles.title}>
            {t('promo.appliedTitle', { code: promo.code })}
          </h2>
          {promo.error ? (
            <p className={styles.problem}>{describeError(promo.code, promo.error, mode)}</p>
          ) : (
            saving && (
              <p className={styles.saving}>
                {t('promo.saving', {
                  amount: money.formatMinor(money.toMinor(promo.quote?.discount ?? 0)),
                })}
              </p>
            )
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={styles.remove}
          onClick={remove}
          aria-label={t('promo.removeLabel', { code: promo.code })}
        >
          {t('promo.remove')}
        </Button>
      </section>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className={cx(styles.card, styles.row)}
        onClick={() => {
          setOpen(true);
          focusNext.current = 'field';
        }}
        aria-expanded={false}
      >
        <span className={styles.icon}>
          <Icon name="tag" size="xs" />
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{t('promo.add')}</span>
          <span className={styles.sub}>{t('promo.addHint')}</span>
        </span>
        <Icon name="chev" size="sm" className={styles.chev} />
      </button>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply(draft);
  };

  return (
    <section className={cx(styles.card, styles.open)} aria-labelledby="promo-title">
      <div className={styles.head}>
        <span className={styles.icon}>
          <Icon name="tag" size="xs" />
        </span>
        <h2 id="promo-title" className={styles.title}>
          {t('promo.add')}
        </h2>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Input
          id={FIELD_ID}
          label={t('promo.label')}
          hideLabel
          className={styles.field}
          placeholder={t('promo.placeholder')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={draft}
          error={error}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
        />
        <Button type="submit" variant="secondary" loading={validate.isPending}>
          {t('promo.apply')}
        </Button>
      </form>
      {available.length > 0 && (
        <>
          <h3 className={styles.listTitle}>{t('promo.available')}</h3>
          <ul className={styles.list}>
            {available.map((p) => (
              <li key={p.code} className={styles.offer}>
                <span className={styles.offerText}>
                  <span className={styles.code}>{p.code}</span>
                  <span className={styles.desc}>{describe(p)}</span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className={styles.offerApply}
                  onClick={() => apply(p.code)}
                  disabled={validate.isPending}
                  aria-label={t('promo.applyLabel', { code: p.code })}
                >
                  {t('promo.apply')}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
