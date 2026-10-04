'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { useBranch, useContent, useRegion } from '@/api/hooks';
import { Button, Icon, OtpInput } from '@/components/ui';
import { useCheckout } from '@/context/CheckoutContext';
import { useToast } from '@/context/ToastContext';
import { useCheckoutGuard } from '@/hooks/useCheckoutGuard';
import { useCountdown } from '@/hooks/useCountdown';
import { useRequestFailed } from '@/hooks/useRequestFailed';
import { useVisitLabel } from '@/hooks/useVisitLabel';
import { isCompleteOtp, wrongCodeError } from '@/lib/checkout';
import { cx } from '@/lib/cx';
import { formatCountdown } from '@/lib/format';
import { CheckoutFrame } from './CheckoutFrame';
import { OrderSummaryPanel } from './OrderSummaryPanel';
import { OtpIllustration } from './OtpIllustration';
import frame from './Checkout.module.css';
import styles from './VerifyStep.module.css';
import { formatMobile } from '@/lib/phone';

/** Step 2 — OTP (10 · w10 · s07 · ws07). Mock code: 123456. */
export function VerifyStep() {
  const ready = useCheckoutGuard('verify');
  const { session } = useCheckout();
  const visit = useVisitLabel();
  const branch = useBranch();
  const t = useContent('checkout');
  return (
    <CheckoutFrame
      step="verify"
      backHref="/checkout/details/"
      backLabel={t('frame.back')}
      ready={ready}
      aside={
        <OrderSummaryPanel
          footnote={t('lines.nameRestaurantVisit', {
            name: session.name,
            restaurant: branch.name,
            visit,
          })}
        />
      }
    >
      {ready && <OtpForm />}
    </CheckoutFrame>
  );
}

function OtpForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const t = useContent('checkout');
  const { session, resendOtp, verifyCode } = useCheckout();
  const { mobile } = useRegion();
  const requestFailed = useRequestFailed();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const checking = useRef(false);
  const { otp } = session;
  const remaining = useCountdown(otp?.resendAt ?? null);
  const locked = otp !== null && otp.attemptsLeft <= 0;
  // The server's rule, as its answers describe it: cooldown over, or after a wrong code.
  const canResend = remaining === 0 || (otp !== null && otp.attemptsLeft < otp.maxAttempts);
  const resendSeconds = otp ? Math.round((otp.resendAt - otp.sentAt) / 1000) : 0;
  const phone = formatMobile(session.phone, mobile);

  const verify = async (value = code) => {
    if (locked || checking.current) return;
    if (!isCompleteOtp(value)) {
      setError(t('verify.errors.incomplete'));
      return;
    }
    checking.current = true;
    const result = await verifyCode(value);
    checking.current = false;
    if (result.status === 'failed') {
      requestFailed();
      return;
    }
    if (result.status === 'wrong') {
      setError(
        wrongCodeError(result.attemptsLeft) === 'locked'
          ? t('verify.errors.locked')
          : t.plural('verify.errors.wrong', result.attemptsLeft),
      );
      return;
    }
    router.push('/checkout/payment/');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void verify();
  };

  const resend = async () => {
    const result = await resendOtp();
    if (result === 'failed') requestFailed();
    if (result !== 'sent') return;
    setCode('');
    setError(null);
    document.getElementById('otp')?.focus();
    showToast(t('verify.toast.resent', { phone }), { tone: 'info' });
  };

  const call = () => showToast(t('verify.toast.call', { phone }), { tone: 'info' });

  const resendControls = canResend ? (
    <>
      <span className={styles.muted}>{t('verify.didntGetIt')}</span>
      <button type="button" className={styles.textBtn} onClick={resend}>
        <Icon name="refresh" size="xs" />
        {t('verify.resendSms')}
      </button>
      <span className={styles.sep} aria-hidden="true">
        ·
      </span>
      <button type="button" className={styles.textBtn} onClick={call}>
        <Icon name="phone" size="xs" />
        {t('verify.getCall')}
      </button>
    </>
  ) : (
    // The ticking countdown is visual only; the hidden status announces start and end.
    <span className={styles.timer} aria-hidden="true">
      <Icon name="clock" size="xs" />
      {t.rich(
        'verify.resendIn',
        { b: (chunks) => <b>{chunks}</b> },
        { time: formatCountdown(remaining ?? resendSeconds) },
      )}
    </span>
  );

  return (
    <form className={styles.verify} onSubmit={onSubmit} noValidate>
      <p className="visually-hidden" role="status">
        {canResend ? t('verify.canResendNow') : t('verify.canResendIn', { seconds: resendSeconds })}
      </p>
      <Link href="/checkout/details/" className={cx(frame.backLink, styles.back, 'hide-mobile')}>
        <Icon name="back" size="xs" />
        {t('frame.back')}
      </Link>

      <div className={styles.column}>
        <OtpIllustration className={styles.art} />
        <h1 className={styles.title}>{t('meta.verify.title')}</h1>
        <p className={styles.sub}>
          {t.rich(
            'verify.sentTo',
            { b: (chunks) => <b className={styles.phone}>{chunks}</b> },
            { phone, dialCode: mobile.dialCode },
          )}
        </p>

        <div className={styles.code}>
          <OtpInput
            id="otp"
            hideLabel
            value={code}
            onChange={(v) => {
              setCode(v);
              if (error && !locked) setError(null);
            }}
            error={error ?? undefined}
            disabled={locked}
            autoFocus
          />
        </div>

        <div className={styles.resend}>{resendControls}</div>

        <Button type="submit" block iconEnd={error ? undefined : 'arrow'} disabled={locked}>
          {t('verify.submit')}
        </Button>

        <Link href="/checkout/details/" className={styles.change}>
          <Icon name="pencil" size="xs" />
          {t('verify.changeNumber')}
        </Link>

        <p className={styles.trust}>
          <Icon name="lock" size="xs" />
          {t('verify.trust')}
        </p>
      </div>
    </form>
  );
}
