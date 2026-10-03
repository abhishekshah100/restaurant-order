'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { OTP_ATTEMPTS, PAYMENT_WINDOW_SECONDS } from '@/lib/constants';
import type { PaymentMethod } from '@/types/order';
import { canResendOtp } from '@/lib/checkout';
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage';
import { useGuestSession } from './GuestSessionContext';

interface CheckoutSession {
  name: string;
  phone: string;
  /** Epoch ms when the last OTP was sent. */
  otpSentAt: number | null;
  attemptsLeft: number;
  verified: boolean;
  method: PaymentMethod;
  /** Epoch ms when the pending UPI request expires (processing screen). */
  paymentEndsAt: number | null;
}

const EMPTY_SESSION: CheckoutSession = {
  name: '',
  phone: '',
  otpSentAt: null,
  attemptsLeft: OTP_ATTEMPTS,
  verified: false,
  method: 'online',
  paymentEndsAt: null,
};

type Action =
  | { type: 'hydrate'; session: CheckoutSession; guestSessionId: string }
  | { type: 'details'; name: string; phone: string; sentAt: number }
  | { type: 'resend'; sentAt: number }
  | { type: 'wrongCode' }
  | { type: 'verified' }
  | { type: 'method'; method: PaymentMethod }
  | { type: 'startPayment'; endsAt: number }
  | { type: 'reset' };

interface State {
  session: CheckoutSession;
  /** The guest session this checkout belongs to; null until the saved one has been read. */
  guestSessionId: string | null;
}

function reducer(state: State, action: Action): State {
  const s = state.session;
  switch (action.type) {
    case 'hydrate':
      return { session: action.session, guestSessionId: action.guestSessionId };
    case 'details': {
      const sameNumber = action.phone === s.phone && s.verified;
      return {
        ...state,
        session: {
          ...s,
          name: action.name.trim(),
          phone: action.phone,
          otpSentAt: action.sentAt,
          attemptsLeft: OTP_ATTEMPTS,
          verified: sameNumber,
        },
      };
    }
    case 'resend':
      if (!canResendOtp(s, action.sentAt)) return state;
      return { ...state, session: { ...s, otpSentAt: action.sentAt, attemptsLeft: OTP_ATTEMPTS } };
    case 'wrongCode':
      return { ...state, session: { ...s, attemptsLeft: Math.max(0, s.attemptsLeft - 1) } };
    case 'verified':
      return { ...state, session: { ...s, verified: true } };
    case 'method':
      return { ...state, session: { ...s, method: action.method } };
    case 'startPayment':
      return { ...state, session: { ...s, method: 'online', paymentEndsAt: action.endsAt } };
    case 'reset':
      return { ...state, session: EMPTY_SESSION };
    default:
      return state;
  }
}

const isEpochOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));

/** Saved with the guest session it belongs to. */
type SavedCheckout = CheckoutSession & { guestSessionId: string };

function isSavedCheckout(v: unknown): v is SavedCheckout {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<keyof SavedCheckout, unknown>;
  return (
    typeof s.guestSessionId === 'string' &&
    typeof s.name === 'string' &&
    typeof s.phone === 'string' &&
    typeof s.verified === 'boolean' &&
    typeof s.attemptsLeft === 'number' &&
    Number.isInteger(s.attemptsLeft) &&
    s.attemptsLeft >= 0 &&
    s.attemptsLeft <= OTP_ATTEMPTS &&
    isEpochOrNull(s.otpSentAt) &&
    isEpochOrNull(s.paymentEndsAt) &&
    (s.method === 'online' || s.method === 'counter')
  );
}

interface CheckoutContextValue {
  session: CheckoutSession;
  hydrated: boolean;
  submitDetails: (name: string, phone: string) => void;
  /** Sends a new code; false (and nothing happens) while the resend cooldown is running. */
  resendOtp: () => boolean;
  recordWrongCode: () => void;
  markVerified: () => void;
  setMethod: (method: PaymentMethod) => void;
  /** Opens a new mock UPI request window. */
  startPayment: () => void;
  reset: () => void;
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

/** The tab's saved checkout if it belongs to this guest session, else a fresh one. */
function readSavedCheckout(guestSessionId: string): CheckoutSession {
  const saved = readJSON(STORAGE_KEYS.checkout, isSavedCheckout, 'session');
  if (saved?.guestSessionId !== guestSessionId) return EMPTY_SESSION;
  const { guestSessionId: _owner, ...session } = saved;
  return { ...EMPTY_SESSION, ...session };
}

/**
 * Checkout details for this tab only (sessionStorage), so a refresh mid-checkout keeps them.
 * Tied to the guest session: a new session starts a fresh checkout.
 */
export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    session: EMPTY_SESSION,
    guestSessionId: null,
  });
  const sessionRef = useRef(state.session);
  const guestId = useGuestSession()?.id;

  useEffect(() => {
    if (guestId)
      dispatch({ type: 'hydrate', session: readSavedCheckout(guestId), guestSessionId: guestId });
  }, [guestId]);

  useEffect(() => {
    sessionRef.current = state.session;
    const { session, guestSessionId } = state;
    if (!guestSessionId) return;
    if (session === EMPTY_SESSION) removeKey(STORAGE_KEYS.checkout, 'session');
    else writeJSON(STORAGE_KEYS.checkout, { ...session, guestSessionId }, 'session');
  }, [state]);

  const submitDetails = useCallback(
    (name: string, phone: string) => dispatch({ type: 'details', name, phone, sentAt: Date.now() }),
    [],
  );
  const resendOtp = useCallback(() => {
    const sentAt = Date.now();
    if (!canResendOtp(sessionRef.current, sentAt)) return false;
    // Mirror the reducer now so a second tap before re-render is refused too.
    sessionRef.current = { ...sessionRef.current, otpSentAt: sentAt, attemptsLeft: OTP_ATTEMPTS };
    dispatch({ type: 'resend', sentAt });
    return true;
  }, []);
  const recordWrongCode = useCallback(() => dispatch({ type: 'wrongCode' }), []);
  const markVerified = useCallback(() => dispatch({ type: 'verified' }), []);
  const setMethod = useCallback(
    (method: PaymentMethod) => dispatch({ type: 'method', method }),
    [],
  );
  const startPayment = useCallback(
    () => dispatch({ type: 'startPayment', endsAt: Date.now() + PAYMENT_WINDOW_SECONDS * 1000 }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  const value = useMemo(
    () => ({
      session: state.session,
      hydrated: state.guestSessionId !== null,
      submitDetails,
      resendOtp,
      recordWrongCode,
      markVerified,
      setMethod,
      startPayment,
      reset,
    }),
    [
      state,
      submitDetails,
      resendOtp,
      recordWrongCode,
      markVerified,
      setMethod,
      startPayment,
      reset,
    ],
  );

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be used inside <CheckoutProvider>');
  return ctx;
}
