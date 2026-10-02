'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { OTP_ATTEMPTS, PAYMENT_WINDOW_SECONDS } from '@/data/restaurant';
import type { PaymentMethod } from '@/types/order';
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage';

export interface CheckoutSession {
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

export const EMPTY_SESSION: CheckoutSession = {
  name: '',
  phone: '',
  otpSentAt: null,
  attemptsLeft: OTP_ATTEMPTS,
  verified: false,
  method: 'online',
  paymentEndsAt: null,
};

type Action =
  | { type: 'hydrate'; session: CheckoutSession }
  | { type: 'details'; name: string; phone: string; sentAt: number }
  | { type: 'resend'; sentAt: number }
  | { type: 'wrongCode' }
  | { type: 'verified' }
  | { type: 'method'; method: PaymentMethod }
  | { type: 'startPayment'; endsAt: number }
  | { type: 'reset' };

interface State {
  session: CheckoutSession;
  hydrated: boolean;
}

function reducer(state: State, action: Action): State {
  const s = state.session;
  switch (action.type) {
    case 'hydrate':
      return { session: action.session, hydrated: true };
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

function isSession(v: unknown): v is CheckoutSession {
  if (!v || typeof v !== 'object') return false;
  const s = v as CheckoutSession;
  return (
    typeof s.name === 'string' && typeof s.phone === 'string' && typeof s.verified === 'boolean'
  );
}

interface CheckoutContextValue {
  session: CheckoutSession;
  hydrated: boolean;
  submitDetails: (name: string, phone: string) => void;
  resendOtp: () => void;
  recordWrongCode: () => void;
  markVerified: () => void;
  setMethod: (method: PaymentMethod) => void;
  /** Opens a new mock UPI request window. */
  startPayment: () => void;
  reset: () => void;
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

/** Checkout details for this tab only (sessionStorage), so a refresh mid-checkout keeps them. */
export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { session: EMPTY_SESSION, hydrated: false });

  useEffect(() => {
    const saved = readJSON(STORAGE_KEYS.checkout, isSession, 'session');
    dispatch({ type: 'hydrate', session: saved ? { ...EMPTY_SESSION, ...saved } : EMPTY_SESSION });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    if (state.session === EMPTY_SESSION) removeKey(STORAGE_KEYS.checkout, 'session');
    else writeJSON(STORAGE_KEYS.checkout, state.session, 'session');
  }, [state]);

  const submitDetails = useCallback(
    (name: string, phone: string) => dispatch({ type: 'details', name, phone, sentAt: Date.now() }),
    [],
  );
  const resendOtp = useCallback(() => dispatch({ type: 'resend', sentAt: Date.now() }), []);
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
      hydrated: state.hydrated,
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
