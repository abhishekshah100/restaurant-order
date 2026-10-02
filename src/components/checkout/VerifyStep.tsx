'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Icon, OtpInput } from '@/components/ui';
import { OTP_RESEND_SECONDS } from '@/data/restaurant';
import { useCheckout } from '@/context/CheckoutContext';
import { useToast } from '@/context/ToastContext';
import { useCheckoutGuard } from '@/hooks/useCheckoutGuard';
import { useCountdown } from '@/hooks/useCountdown';
import { useTable } from '@/hooks/useTable';
import { checkOtp, displayPhone, wrongCodeMessage } from '@/lib/checkout';
import { cx } from '@/lib/cx';
import { formatCountdown } from '@/lib/format';
import { CheckoutFrame } from './CheckoutFrame';
import { OrderSummaryPanel } from './OrderSummaryPanel';
import styles from './Checkout.module.css';

/** Step 2 — OTP (10 · w10 · s07 · ws07). Mock code: 123456. */
export function VerifyStep() {
  const ready = useCheckoutGuard('verify');
  const { session } = useCheckout();
  const table = useTable();
  return (
    <CheckoutFrame
      step="verify"
      backHref="/checkout/details/"
      backLabel="Back"
      ready={ready}
      aside={<OrderSummaryPanel footnote={`${session.name} · The Olive Table · Table ${table}`} />}
    >
      {ready && <OtpForm />}
    </CheckoutFrame>
  );
}

function OtpForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const { session, resendOtp, recordWrongCode, markVerified } = useCheckout();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const endsAt = session.otpSentAt === null ? null : session.otpSentAt + OTP_RESEND_SECONDS * 1000;
  const remaining = useCountdown(endsAt);
  const locked = session.attemptsLeft <= 0;
  const canResend = remaining === 0 || Boolean(error);
  const phone = displayPhone(session.phone);

  const verify = (value = code) => {
    if (locked) return;
    const result = checkOtp(value);
    if (result === 'incomplete') {
      setError('Enter all 6 digits of the code.');
      return;
    }
    if (result === 'wrong') {
      recordWrongCode();
      setError(wrongCodeMessage(session.attemptsLeft - 1));
      return;
    }
    markVerified();
    router.push('/checkout/payment/');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    verify();
  };

  const resend = () => {
    resendOtp();
    setCode('');
    setError(null);
    document.getElementById('otp')?.focus();
    showToast(`New code sent to ${phone}`, { tone: 'info' });
  };

  const call = () =>
    showToast(`You'll get a call on ${phone} with the code shortly`, { tone: 'info' });

  const resendControls = canResend ? (
    <div className={styles.resendLinks}>
      <button type="button" className={styles.textBtn} onClick={resend}>
        <Icon name="refresh" size="xs" />
        Resend SMS
      </button>
      <button type="button" className={styles.textBtn} onClick={call}>
        <Icon name="phone" size="xs" />
        Get a call<span className="hide-mobile"> instead</span>
      </button>
    </div>
  ) : (
    <span className={cx('t-small c3', styles.timer)} aria-live="polite">
      <span className="hide-desktop">Resend code in </span>
      <span className="hide-mobile">Resend in </span>
      {remaining === null ? `0:${OTP_RESEND_SECONDS}` : formatCountdown(remaining)}
    </span>
  );

  return (
    <form className={styles.stack} onSubmit={onSubmit} noValidate>
      <div className={styles.intro}>
        <Link href="/checkout/details/" className={cx(styles.backLink, 'hide-mobile')}>
          <Icon name="back" size="xs" />
          Back
        </Link>
        <h1 className={styles.title}>Enter the 6-digit code</h1>
        <p className="t-body c2">
          Sent by SMS to <b className={styles.ink}>{phone}</b>
          <span className="hide-mobile">
            {' '}
            ·{' '}
            <Link href="/checkout/details/" className={styles.inlineLink}>
              Change number
            </Link>
          </span>
        </p>
        <Link
          href="/checkout/details/"
          className={cx(styles.backLink, styles.changeLink, 'hide-desktop')}
        >
          <Icon name="pencil" size="xs" />
          Change number
        </Link>
      </div>

      <div className={styles.otp}>
        <OtpInput
          id="otp"
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error && !locked) setError(null);
          }}
          error={error ?? undefined}
          disabled={locked}
          autoFocus
          hint={
            error ? undefined : (
              <>
                <Icon name="mobile" size="xs" />
                <span className="hide-desktop">
                  On most phones the code fills in automatically.
                </span>
                <span className="hide-mobile">
                  Tip: you can paste the whole code into the first box.
                </span>
              </>
            )
          }
        />
        <p className={styles.demo}>Prototype: the code is 123456</p>
      </div>

      <div className={cx(styles.resendRow, 'hide-desktop')}>
        <span className="t-small c2">Didn&apos;t get it?</span>
        {resendControls}
      </div>

      <div className={cx(styles.desktopFoot, 'hide-mobile')}>
        <span className={cx('t-small c2', styles.resendInline)}>
          {!canResend && <>Didn&apos;t get it? </>}
          {resendControls}
        </span>
        <Button type="submit" iconEnd={error ? undefined : 'arrow'} disabled={locked}>
          Verify &amp; continue
        </Button>
      </div>

      <div className={cx(styles.formFoot, 'hide-desktop')}>
        <Button type="submit" block iconEnd={error ? undefined : 'arrow'} disabled={locked}>
          Verify &amp; continue
        </Button>
      </div>
    </form>
  );
}
