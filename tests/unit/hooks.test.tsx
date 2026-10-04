import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { CheckoutProvider, useCheckout } from '@/context/CheckoutContext';
import { GuestSessionProvider } from '@/context/GuestSessionContext';
import { useCountdown } from '@/hooks/useCountdown';
import { useQueryParam } from '@/hooks/useQueryParam';
import { OTP_ATTEMPTS, OTP_RESEND_SECONDS } from '@/api/mock/rules';
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

describe('OTP (CheckoutProvider over the mock server)', () => {
  const sentAt = 1_000_000;

  async function renderCheckout() {
    seedGuestSession();
    const view = renderHook(() => useCheckout(), { wrapper: checkoutWrapper });
    await waitFor(() => expect(view.result.current.hydrated).toBe(true));
    return view;
  }

  it('sends a code and refuses a resend during the cooldown, until a wrong code', async () => {
    vi.useFakeTimers({ now: sentAt, toFake: ['Date'] });
    const { result } = await renderCheckout();
    let sent = false;
    await act(async () => {
      sent = await result.current.submitDetails('Ananya', '9876543210');
    });
    expect(sent).toBe(true);
    expect(result.current.session).toMatchObject({
      name: 'Ananya',
      phone: '9876543210',
      verified: false,
      otp: {
        sentAt,
        resendAt: sentAt + OTP_RESEND_SECONDS * 1000,
        attemptsLeft: OTP_ATTEMPTS,
        maxAttempts: OTP_ATTEMPTS,
      },
    });

    vi.setSystemTime(sentAt + 5000);
    let resend = '';
    await act(async () => {
      resend = await result.current.resendOtp();
    });
    expect(resend).toBe('tooSoon');
    expect(result.current.session.otp?.sentAt).toBe(sentAt);

    let check: Awaited<ReturnType<typeof result.current.verifyCode>> = { status: 'failed' };
    await act(async () => {
      check = await result.current.verifyCode('482719');
    });
    expect(check).toEqual({ status: 'wrong', attemptsLeft: OTP_ATTEMPTS - 1 });
    // A wrong code unlocks a resend straight away.
    await act(async () => {
      resend = await result.current.resendOtp();
    });
    expect(resend).toBe('sent');
    expect(result.current.session.otp).toMatchObject({
      sentAt: sentAt + 5000,
      attemptsLeft: OTP_ATTEMPTS,
    });
  });

  it('verifies the right code', async () => {
    const { result } = await renderCheckout();
    await act(async () => {
      await result.current.submitDetails('Ananya', '9876543210');
    });
    let check: Awaited<ReturnType<typeof result.current.verifyCode>> = { status: 'failed' };
    await act(async () => {
      check = await result.current.verifyCode('123456');
    });
    expect(check).toEqual({ status: 'verified' });
    expect(result.current.session.verified).toBe(true);
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
        otp: null,
        verified: true,
        method: 'online',
        payment: null,
      }),
    );

  it('restores the checkout saved by this guest session', async () => {
    const { id } = seedGuestSession();
    saveCheckout(id);
    const { result } = renderHook(() => useCheckout(), { wrapper: checkoutWrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.session).toMatchObject({ name: 'Ravi', verified: true });
  });

  it('starts afresh when the saved checkout belongs to another guest session', async () => {
    seedGuestSession();
    saveCheckout('another-guest');
    const { result } = renderHook(() => useCheckout(), { wrapper: checkoutWrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.session).toMatchObject({ name: '', verified: false });
    expect(window.sessionStorage.getItem(STORAGE_KEYS.checkout)).toBeNull();
  });
});
