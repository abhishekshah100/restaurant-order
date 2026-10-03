import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { CheckoutProvider, useCheckout } from '@/context/CheckoutContext';
import { GuestSessionProvider } from '@/context/GuestSessionContext';
import { useCountdown } from '@/hooks/useCountdown';
import { useQueryParam } from '@/hooks/useQueryParam';
import { OTP_ATTEMPTS, OTP_RESEND_SECONDS } from '@/lib/constants';
import { canResendOtp } from '@/lib/checkout';
import { STORAGE_KEYS } from '@/lib/storage';
import { ApiTestProvider, seedGuestSession } from '../apiState';

const checkoutWrapper = ({ children }: { children: ReactNode }) => (
  <ApiTestProvider>
    <GuestSessionProvider>
      <CheckoutProvider>{children}</CheckoutProvider>
    </GuestSessionProvider>
  </ApiTestProvider>
);

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
  window.sessionStorage.clear();
});

describe('useCountdown', () => {
  it('counts down and stops ticking at 0', () => {
    vi.useFakeTimers();
    const endsAt = Date.now() + 2000;
    const { result } = renderHook(() => useCountdown(endsAt));
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toBe(2);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useQueryParam', () => {
  it('follows pushState / replaceState as well as back and forward', async () => {
    window.history.replaceState(null, '', '/checkout/processing/?state=payment-failed');
    const { result } = renderHook(() => useQueryParam('state'));
    expect(result.current).toBe('payment-failed');
    await act(async () => window.history.replaceState(null, '', '/checkout/processing/'));
    expect(result.current).toBeNull();
    await act(async () => window.history.pushState(null, '', '/?state=payment-cancelled'));
    expect(result.current).toBe('payment-cancelled');
  });
});

describe('OTP resend', () => {
  const sentAt = 1_000_000;

  it('unlocks after the cooldown or after a wrong code', () => {
    const fresh = { otpSentAt: sentAt, attemptsLeft: OTP_ATTEMPTS };
    expect(canResendOtp(fresh, sentAt + 1000)).toBe(false);
    expect(canResendOtp(fresh, sentAt + OTP_RESEND_SECONDS * 1000)).toBe(true);
    expect(canResendOtp({ ...fresh, attemptsLeft: OTP_ATTEMPTS - 1 }, sentAt + 1000)).toBe(true);
    expect(canResendOtp({ otpSentAt: null, attemptsLeft: OTP_ATTEMPTS }, 0)).toBe(true);
  });

  it('ignores a resend during the cooldown', () => {
    vi.useFakeTimers({ now: sentAt });
    const { result } = renderHook(() => useCheckout(), { wrapper: checkoutWrapper });
    act(() => result.current.submitDetails('Ananya', '9876543210'));
    act(() => vi.advanceTimersByTime(5000));
    let sent = true;
    act(() => {
      sent = result.current.resendOtp();
    });
    expect(sent).toBe(false);
    expect(result.current.session.otpSentAt).toBe(sentAt);

    act(() => result.current.recordWrongCode());
    act(() => {
      sent = result.current.resendOtp();
    });
    expect(sent).toBe(true);
    expect(result.current.session).toMatchObject({
      otpSentAt: sentAt + 5000,
      attemptsLeft: OTP_ATTEMPTS,
    });
  });
});

describe('checkout session', () => {
  afterEach(() => window.sessionStorage.clear());

  const saveCheckout = (guestSessionId: string) =>
    window.sessionStorage.setItem(
      STORAGE_KEYS.checkout,
      JSON.stringify({
        guestSessionId,
        name: 'Ravi',
        phone: '9876543210',
        otpSentAt: null,
        attemptsLeft: OTP_ATTEMPTS,
        verified: true,
        method: 'online',
        paymentEndsAt: null,
      }),
    );

  it('restores the checkout saved by this guest session', () => {
    const { id } = seedGuestSession();
    saveCheckout(id);
    const { result } = renderHook(() => useCheckout(), { wrapper: checkoutWrapper });
    expect(result.current.hydrated).toBe(true);
    expect(result.current.session).toMatchObject({ name: 'Ravi', verified: true });
  });

  it('starts afresh when the saved checkout belongs to another guest session', () => {
    seedGuestSession();
    saveCheckout('another-guest');
    const { result } = renderHook(() => useCheckout(), { wrapper: checkoutWrapper });
    expect(result.current.hydrated).toBe(true);
    expect(result.current.session).toMatchObject({ name: '', verified: false });
    expect(window.sessionStorage.getItem(STORAGE_KEYS.checkout)).toBeNull();
  });
});
